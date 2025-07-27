import * as Core from './Core'


type AlgInfo = [(cap: Core.Capture) => void, string]

const ALGS = new Array<AlgInfo>(
    [alg0, 'sleep current prior to first event'],
    [alg1, '*** WIP ***'],
    [alg2, 'lowest sleep current across overlapped .5s windows'],
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

function alg2(cap: Core.Capture) {
    let min_cur = Number.POSITIVE_INFINITY
    let min_std = Number.POSITIVE_INFINITY
    let m: Core.Marker = {
        sample_offset: 0,
        sample_count: cap.secsToSampleIndex(.5),
    }
    while ((m.sample_offset + m.sample_count) < cap.sample_count) {
        const sleep_data = cap.markerArray(m)
        Core.avg(sleep_data)
        const cur = Core.avg(sleep_data)
        const std = Core.stdDev(sleep_data)
        if (cur < min_cur) {
            min_cur = cur
            min_std = std
        }
        m.sample_offset += m.sample_count / 2
    }
    const vol = Core.toEng(cap.avg_voltage, 'V')
    const cur = Core.toEng(min_cur, 'A')
    const std = Core.toEng(min_std, 'A')
    console.log(`voltage = ${vol}, sleep current = ${cur}, std = ${std}`)

}
