import * as Core from './Core'

type Params = {
    gap?: number
    min_dur?: number
    min_egy?: number
    trim?: number
}

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    let params: Params = {}
    if (opts.refresh) {
        if (cap.analysis) {
            for (const opt of cap.analysis?.options) {
                const a = opt.split(' ')
                const [pname, pval] = [a[0].slice(2), Number(a[1])];
                (params as any)[pname] = Number(pval)
            }
            if (Number.isNaN(params.trim)) {
                params.trim = cap.analysis.events.length
            }
        }
    } else {
        params.gap = opts.gap
        params.min_dur = opts.minDuration
        params.min_egy = opts.minEnergy
        params.trim = opts.trim
    }
    const aobj = analyze(cap, params)
    cap.bind(aobj)
}

export function analyze(cap: Core.Capture, params: Params = {}): Core.Analysis {
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
                markers.push(rwin.toMarker())
            }
        }
    }
    let options = new Array<string>()
    if (params.gap !== undefined) {
        markers = combineMarkers(rsig, markers, rsig.secsToOff(params.gap! / 1000))
        options.push(`--gap ${params.gap}`)

    }
    if (params.min_dur != undefined) {
        const min_wid = rsig.secsToOff(params.min_dur / 1000)
        markers = markers.filter(m => m.width >= min_wid)
        options.push(`--min-duration ${params.min_dur}`)
    }
    if (params.min_egy != undefined) {
        markers = markers.filter(m => cap.energyWithin(m) >= params.min_egy! / 1_000_000)
        options.push(`--min-energy ${params.min_egy}`)
    }

    let span = rsig.window(rsig.data.length).toMarker()
    if (params.trim) {
        [span, markers] = trimEvents(cap, markers, params.trim!)
        options.push(`--trim ${params.trim}`)
    }
    Core.infoMsg(`found ${markers.length} event(s)`)
    return { span: span, events: markers, sleep: si, options: options, version: Core.version() }
}

function combineMarkers(sig: Core.Signal, markers: Core.Marker[], gap: number): Core.Marker[] {
    let res = new Array<Core.Marker>()
    for (const m of markers) {
        if (res.length == 0) {
            res.push(m)
            continue
        }
        const last = res[res.length - 1]
        if ((last.offset + last.width + gap) < m.offset) {
            res.push(m)
            continue
        }
        last.width += gap + m.width
    }
    return res
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
        const m = win.toMarker()
        if (cur < min_cur) {
            min_cur = cur
            std = wsig.std()
            p95 = slopeP95(wsig.data)
            off = m.offset
        }
        win.slide(m.width / 2)
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

function trimEvents(cap: Core.Capture, markers: Core.Marker[], count: number): [Core.Marker, Core.Marker[]] {
    Core.fail('insufficient number of events', markers.length < count)
    const rsig = cap.current_sig
    const margin = rsig.secsToOff(.5)
    const end_idx = markers.findLastIndex(m => (m.offset + margin) < rsig.data.length)
    const beg_idx = end_idx - count
    Core.fail('insufficient number of events', markers[beg_idx].offset < margin)
    const wid = rsig.secsToOff(count)
    const off = markers[beg_idx].offset - margin
    const span = rsig.window(wid, off).toMarker()
    return [span, markers.slice(beg_idx, end_idx)]
}
