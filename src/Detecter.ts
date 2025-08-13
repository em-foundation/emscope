import * as Core from './Core'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const aobj = analyze(cap, opts.trim)
    cap.bind(aobj)
}

export function analyze(cap: Core.Capture, trim?: boolean): Core.Analysis {
    Core.infoMsg('analyzing captured data...')
    const rsig = cap.current_sig
    const width = rsig.secsToOff(250e-6)
    const asig = rsig.mapMean(width)
    const si = measureSleep(asig)
    const min_thresh = si.avg + si.std
    const max_thresh = 1e-3
    let active = false
    let start = -1
    let markers = new Array<Core.Marker>()
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
                markers.push(rwin.marker)
            }
        }
    }
    let span = rsig.window(rsig.data.length).marker
    if (trim) {
        [span, markers] = trimEvents(cap, markers)
    }
    Core.infoMsg(`found ${markers.length} event(s)`)
    return { span: span, events: markers, sleep: si }
}

function measureSleep(osig: Core.Signal): Core.SleepInfo {
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

function trimEvents(cap: Core.Capture, markers: Core.Marker[]): [Core.Marker, Core.Marker[]] {
    const ev_cnt = cap.duration - 2
    Core.fail('insufficient number of events', markers.length < ev_cnt)
    const rsig = cap.current_sig
    const margin = rsig.secsToOff(.5)
    const end_idx = markers.findLastIndex(m => (m.offset + margin) < rsig.data.length)
    const beg_idx = end_idx - ev_cnt
    const wid = rsig.secsToOff(ev_cnt)
    const off = markers[beg_idx].offset - margin
    const span = rsig.window(wid, off)
    return [span, markers.slice(beg_idx, end_idx)]
}
