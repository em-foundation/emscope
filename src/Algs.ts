import * as Core from './Core'


type AlgInfo = [(cap: Core.Capture) => void, string]

const ALGS = new Array<AlgInfo>(
    [alg0, 'sleep current prior to first event'],
    [alg1, '*** WIP ***'],
    [alg2, 'lowest sleep current across overlapped .5s windows'],
    [alg3, 'initial activity search using alg2 output'],
)

export async function exec(opts: any) {
    const alg_nums = opts.algorithmNumbers
    if (alg_nums === undefined) {
        for (const [i, [_, desc]] of ALGS.entries()) {
            console.log(`algorithm ${i}: ${desc}`)
        }
        return
    }
    const cap = Core.Capture.load(opts.capture)
    for (const i of alg_nums) {
        const [algFxn, desc] = ALGS[i]
        console.log(`\n---- algorithm ${i}: ${desc} ----\n`)
        algFxn(cap)
    }
}

function alg0(cap: Core.Capture) {
    const ev0 = cap.analysis.events.markers[0]
    const m: Core.Marker = {
        sample_offset: ev0.sample_offset - cap.secsToSampleIndex(.40),
        sample_count: cap.secsToSampleIndex(.25)
    }
    const sleep_data = cap.markerArray(m)
    Core.avg(sleep_data)
    const vol = Core.toEng(cap.avg_voltage, 'V')
    const cur = Core.toEng(Core.avg(sleep_data), 'A')
    const std = Core.toEng(Core.stdDev(sleep_data), 'A')
    console.log(`voltage = ${vol}, sleep current = ${cur}, std = ${std}`)
    // const pre = 50
    // const data = cap.current_ds.data.subarray(ev0.sample_offset - pre, ev0.sample_offset)
    // for (const [i, v] of data.entries()) {
    //     console.log(`${i - pre}: ${Core.toEng(v, 'A')}`)
    // }
    console.log(ev0)
}

function alg1(cap: Core.Capture) {

    const MIN_STD_DEV = 0.0001
    const MIN_DURATION = .25

    const data = cap.current_ds.data
    const min_samples = cap.secsToSampleIndex(MIN_DURATION)
    let hist = new Array<number>()
    let sleeping = true
    const pre = 100
    for (const [i, v] of data.subarray(pre).entries()) {
        hist.push(v)
        if (sleeping) {
            const sd = Core.stdDev(hist)
            if (sd < MIN_STD_DEV) {
                sleeping = false
            }
            continue
        }
        if (hist.length >= min_samples) {
            const sd = Core.stdDev(hist)
            if (sd < MIN_STD_DEV) {
                const time = Core.toEng(cap.sampleIndexToSecs(pre + i + 1 - hist.length), 's')
                console.log(`${time}: sleep avg = ${Core.toEng(Core.avg(hist), 'A')}`)
                process.exit()
            } else {
                hist.shift()
            }
        }
    }
}

function alg2(cap: Core.Capture): { avg: number, std: number, p95: number } {
    let min_cur = Number.POSITIVE_INFINITY
    let std = 0
    let p95 = 0
    let m: Core.Marker = {
        sample_offset: 0,
        sample_count: cap.secsToSampleIndex(.5),
    }
    while ((m.sample_offset + m.sample_count) < cap.sample_count) {
        const sleep_data = cap.markerArray(m)
        Core.avg(sleep_data)
        const cur = Core.avg(sleep_data)
        if (cur < min_cur) {
            min_cur = cur
            std = Core.stdDev(sleep_data)
            p95 = slopeP95(sleep_data)
        }
        m.sample_offset += m.sample_count / 2
    }
    const vol_s = Core.toEng(cap.avg_voltage, 'V')
    const cur_s = Core.toEng(min_cur, 'A')
    const std_s = Core.toEng(std, 'A')
    console.log(`voltage = ${vol_s}, sleep current = ${cur_s}, std = ${std_s}, p95 = ${p95.toExponential(2)}`)
    return { avg: min_cur, std: std, p95: p95 }
}

function alg3(cap: Core.Capture) {
    const { avg, std, p95 } = alg2(cap)
    const N1 = 5
    const N2 = 4
    const ampT = avg + (N1 * std)
    const slopeT = N2 * p95
    const eps = 2 * std
    console.log(`ampT = ${Core.toEng(ampT, 'A')}, slopeT = ${slopeT.toExponential(2)}`)
    let markers = new Array<Core.Marker>()
    let y0 = 0
    let active = false
    let nxt_marker = new Core.Marker()
    for (const [i, v] of cap.current_ds.data.entries()) {
        // if (i == 2_000_000) break
        const dy = v - y0
        y0 = v
        if (!active && ((v > ampT) || (Math.abs(dy) > slopeT))) {
            active = true
            nxt_marker.sample_offset = i
            continue
        }
        if (active && (v <= avg + eps) && (Math.abs(dy) <= p95)) {
            active = false
            nxt_marker.sample_count = i - nxt_marker.sample_offset
            markers.push(nxt_marker)
            nxt_marker = new Core.Marker()
            continue
        }
    }
    const min_samples = cap.secsToSampleIndex(500e-6)
    markers.filter(m => m.sample_count > min_samples).forEach(m => console.log(m))
}

function slopeP95(data: Float32Array): number {
    const slope = new Array<number>()
    for (let i = 1; i < data.length; i++) {
        slope.push(Math.abs(data[i] - data[i - 1]))
    }
    const sorted = [...slope].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(0.95 * sorted.length)]
    return p95
}
