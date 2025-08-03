import * as Analyzer from './Analyzer'
import * as Core from './Core'
import * as Exporter from './Exporter'

type AlgInfo = [(cap: Core.Capture) => void, string]
type SleepInfo = { avg: number, std: number, p95: number, off: number }

const ALGS = new Array<AlgInfo>(
    [alg0, 'default analysis'],
    [alg1, 'lowest sleep current across overlapped .5s windows'],
    [alg2, 'active event search using alg2 output'],
    [alg3, 'min/max/mean bins'],
    [alg4, 'alg1 offset'],
    [alg5, 'test'],
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
    const aobj = Analyzer.exec(cap)
    console.dir(aobj, { depth: null, colors: true })
}

function alg1(cap: Core.Capture) {
    const si = findSleep(cap.current_sig)
    printSleep(si, cap.avg_voltage)
}

function alg2(cap: Core.Capture) {
    const { avg, std, p95 } = findSleep(cap.current_sig)
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
    const max_gap = cap.secsToSampleIndex(10e-3)
    const merged = mergeMarkers(markers.filter(m => m.sample_count > min_samples), max_gap)
    console.log(`    found ${merged.length} events`)
    // for (const m of merged) {
    //     console.log(cap.markerLocation(m).toFixed(2).padStart(5, '0'), Core.toEng(cap.markerDuration(m), 's'))
    // }
    Exporter.saveMarkers(cap, `${cap.basename}--alg2`, merged)
}

function alg3(cap: Core.Capture) {
    const width = cap.secsToSampleIndex(250e-6)
    const bins = Core.bin3M(cap.current_ds.data, width)
    const f32 = new Float32Array(bins.map(b => b[2]))
    Exporter.saveData(cap, `${cap.basename}--alg3`, f32, cap.sampling_rate / width)
}

function alg4(cap: Core.Capture) {
    const { off } = findSleep(cap.current_sig)
    console.log(`off = ${off}`)
}

function alg5(cap: Core.Capture) {
    const si = findSleep(cap.current_sig)
    console.log(`voltage = ${cap.avg_voltage.toFixed(2)}, sleep current = ${amps(si.avg)}, std = ${amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
}

function amps(val: number): string {
    return Core.toEng(val, 'A')
}

function findSleep(osig: Core.Signal): SleepInfo {
    let min_cur = Number.POSITIVE_INFINITY
    let std = 0
    let p95 = 0
    let off = 0
    const win = osig.window(osig.secsToOff(.5))
    while (win.valid()) {
        const wsig = win.toSignal()
        const cur = wsig.avg()
        if (cur < min_cur) {
            min_cur = cur
            std = wsig.std()
            p95 = slopeP95(wsig.data)
            off = win.offset
        }
        win.slide(win.width / 2)
    }
    return { avg: min_cur, std: std, p95: p95, off: off }
}

function mergeMarkers(markers: Core.Marker[], max_gap: number): Core.Marker[] {
    if (markers.length === 0) return []
    const merged: Core.Marker[] = []
    let prev = markers[0]
    for (let i = 1; i < markers.length; i++) {
        const next = markers[i]
        const gap = next.sample_offset - (prev.sample_offset + prev.sample_count)
        if (gap <= max_gap) {
            const new_end = next.sample_offset + next.sample_count
            prev.sample_count = new_end - prev.sample_offset
        } else {
            merged.push(prev)
            prev = next
        }
    }
    merged.push(prev)
    return merged
}

function printSleep(si: SleepInfo, voltage: number) {
    console.log(`sleep current = ${amps(si.avg)} @ ${voltage.toFixed(2)} V, std = ${amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
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

