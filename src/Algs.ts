import * as Analyzer from './Analyzer'
import * as Core from './Core'
import * as Exporter from './Writer'

// type SleepInfo = { avg: number, std: number, p95: number, off: number }

// export async function exec(opts: any) {
//     const alg_nums = opts.algorithmNumbers
//     if (alg_nums === undefined) {
//         for (const [i, [_, desc]] of ALGS.entries()) {
//             console.log(`algorithm ${i}: ${desc}`)
//         }
//         return
//     }
//     const cap = Core.Capture.load(opts.capture)
//     for (const i of alg_nums) {
//         const [algFxn, desc] = ALGS[i]
//         console.log(`\n---- capture ${cap.basename}: algorithm ${i}: ${desc} ----\n`)
//         algFxn(cap)
//     }
// }

// function alg0(cap: Core.Capture) {
//     const aobj = Analyzer.exec(cap)
//     console.dir(aobj, { depth: null, colors: true })
// }
// 
// function alg1(cap: Core.Capture) {
//     const si = findSleep(cap.current_sig)
//     printSleep(si, cap.avg_voltage)
// }
// 
// function alg2(cap: Core.Capture) {
//     const { avg, std, p95 } = findSleep(cap.current_sig)
//     const N1 = 5
//     const N2 = 4
//     const ampT = avg + (N1 * std)
//     const slopeT = N2 * p95
//     const eps = 2 * std
//     console.log(`ampT = ${Core.toEng(ampT, 'A')}, slopeT = ${slopeT.toExponential(2)}`)
//     let markers = new Array<Core.Marker>()
//     let y0 = 0
//     let active = false
//     let nxt_marker = new Core.Marker()
//     for (const [i, v] of cap.current_ds.data.entries()) {
//         const dy = v - y0
//         y0 = v
//         if (!active && ((v > ampT) || (Math.abs(dy) > slopeT))) {
//             active = true
//             nxt_marker.offset = i
//             continue
//         }
//         if (active && (v <= avg + eps) && (Math.abs(dy) <= p95)) {
//             active = false
//             nxt_marker.width = i - nxt_marker.offset
//             markers.push(nxt_marker)
//             nxt_marker = new Core.Marker()
//             continue
//         }
//     }
//     const min_samples = cap.secsToSampleIndex(500e-6)
//     const max_gap = cap.secsToSampleIndex(10e-3)
//     const merged = mergeMarkers(markers.filter(m => m.width > min_samples), max_gap)
//     console.log(`    found ${merged.length} events`)
//     // for (const m of merged) {
//     //     console.log(cap.markerLocation(m).toFixed(2).padStart(5, '0'), Core.toEng(cap.markerDuration(m), 's'))
//     // }
//     Exporter.saveMarkers(cap, `${cap.basename}--alg2`, merged)
// }
// 
// function alg3(cap: Core.Capture) {
//     const sig = cap.current_sig
//     const width = sig.secsToOff(250e-6)
//     Exporter.saveSignal(cap, `${cap.basename}--alg3`, sig.mapMean(width))
// }
// 
// function alg4(cap: Core.Capture) {
//     const { off } = findSleep(cap.current_sig)
//     console.log(`off = ${off}`)
// }

// function alg5(cap: Core.Capture) {
//     const rsig = cap.current_sig
//     const width = rsig.secsToOff(250e-6)
//     const asig = rsig.mapMean(width)
//     const si = findSleep(asig)
//     const min_thresh = si.avg + si.std
//     const max_thresh = 1e-3
//     // printSleep(si, cap.avg_voltage)
//     let active = false
//     let start = -1
//     let charge_list = new Array<number>()
//     let markers = new Array<Core.MarkerI>()
//     for (const [i, v] of asig.data.entries()) {
//         if (!active && v > min_thresh) {
//             active = true
//             start = i
//             continue
//         }
//         if (active && v < min_thresh) {
//             active = false
//             const win = asig.window(i - start, start)
//             const wsig = win.toSignal()
//             if (wsig.max() > max_thresh) {
//                 const rwin = win.scale(rsig)
//                 markers.push(rwin)
//                 charge_list.push(rwin.toSignal().integral())
//                 // console.log(joules(wsig.integral(), cap.avg_voltage))
//                 // console.log(`off = ${start}, wid = ${i - start}`)
//             }
//         }
//     }
//     console.log(`${charge_list.length} events: ${joules(Core.avg(charge_list), cap.avg_voltage)}`)
//     Exporter.saveSignal(cap, `${cap.basename}--alg5`, rsig, markers)
// }

// function amps(val: number): string {
//     return Core.toEng(val, 'A')
// }

// function findSleep(osig: Core.Signal): SleepInfo {
//     let min_cur = Number.POSITIVE_INFINITY
//     let std = 0
//     let p95 = 0
//     let off = 0
//     const win = osig.window(osig.secsToOff(.5))
//     while (win.valid()) {
//         const wsig = win.toSignal()
//         const cur = wsig.avg()
//         if (cur < min_cur) {
//             min_cur = cur
//             std = wsig.std()
//             p95 = slopeP95(wsig.data)
//             off = win.offset
//         }
//         win.slide(win.width / 2)
//     }
//     return { avg: min_cur, std: std, p95: p95, off: off }
// }
// 
// function mergeMarkers(markers: Core.Marker[], max_gap: number): Core.Marker[] {
//     if (markers.length === 0) return []
//     const merged: Core.Marker[] = []
//     let prev = markers[0]
//     for (let i = 1; i < markers.length; i++) {
//         const next = markers[i]
//         const gap = next.offset - (prev.offset + prev.width)
//         if (gap <= max_gap) {
//             const new_end = next.offset + next.width
//             prev.width = new_end - prev.offset
//         } else {
//             merged.push(prev)
//             prev = next
//         }
//     }
//     merged.push(prev)
//     return merged
// }
// 
// function printSleep(si: SleepInfo, voltage: number) {
//     console.log(`sleep current = ${amps(si.avg)} @ ${voltage.toFixed(2)} V, std = ${amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
// }

// function slopeP95(data: Float32Array): number {
//     const slope = new Array<number>()
//     for (let i = 1; i < data.length; i++) {
//         slope.push(Math.abs(data[i] - data[i - 1]))
//     }
//     const sorted = [...slope].sort((a, b) => a - b)
//     const p95 = sorted[Math.floor(0.95 * sorted.length)]
//     return p95
// }

export class KalmanFilter {
    q: number
    r: number
    p: number
    x: number
    constructor(
        initialEstimate: number,
        processNoise: number,
        measurementNoise: number,
        estimateCovariance: number
    ) {
        this.x = initialEstimate
        this.p = estimateCovariance
        this.q = processNoise
        this.r = measurementNoise
    }
    update(measurement: number): number {
        this.p += this.q
        const k = this.p / (this.p + this.r)  // Kalman gain
        this.x = this.x + k * (measurement - this.x) // Update estimate
        this.p = (1 - k) * this.p
        return this.x
    }
}

