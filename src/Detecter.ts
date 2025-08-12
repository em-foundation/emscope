import * as Core from './Core'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const aobj = detectEvents(cap)
    cap.bind(aobj)
}

export function detectEvents(cap: Core.Capture): Core.Analysis {
    const rsig = cap.current_sig
    const width = rsig.secsToOff(250e-6)
    const asig = rsig.mapMean(width)
    const si = detectSleep(asig)
    const min_thresh = si.avg + si.std
    const max_thresh = 1e-3
    let active = false
    let start = -1
    let charge_list = new Array<number>()
    let markers = new Array<Core.MarkerI>()
    for (const [i, v] of asig.data.entries()) {
        if (!active && v > min_thresh) {
            active = true
            start = i
            continue
        }
        if (active && v < min_thresh) {
            active = false
            const win = asig.window(i - start, start)
            const wsig = win.toSignal()
            if (wsig.max() > max_thresh) {
                const rwin = win.scale(rsig)
                markers.push(rwin)
                charge_list.push(rwin.toSignal().integral())
            }
        }
    }
    const span = rsig.window(rsig.data.length).marker
    return { span: span, events: markers, sleep: si }
}

export function detectSleep(osig: Core.Signal): Core.SleepInfo {
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

function slopeP95(data: Float32Array): number {
    const slope = new Array<number>()
    for (let i = 1; i < data.length; i++) {
        slope.push(Math.abs(data[i] - data[i - 1]))
    }
    const sorted = [...slope].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(0.95 * sorted.length)]
    return p95
}
