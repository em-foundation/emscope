import * as Core from './Core'

type Params = {
    event_win?: number
    gap?: number
    min_dur?: number
    min_egy?: number
    sleep_win?: number
    trim?: number
}

const NO_CURRENT = 0

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    let params: Params = {}
    if (opts.refresh) {
        if (cap.analysis) {
            for (const opt of cap.analysis?.options) {
                applyOption(params, opt)
            }
            if (Number.isNaN(params.trim)) {
                params.trim = cap.analysis.events.length
            }
        }
    } else {
        params.event_win = opts.eventWindow
        params.gap = opts.gap
        params.min_dur = opts.minDuration
        params.min_egy = opts.minEnergy
        params.sleep_win = opts.sleepWindow
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
    let si = measureSleep(asig, rsig, params.sleep_win)
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
    let event_width: number | undefined
    if (params.event_win !== undefined) {
        event_width = rsig.secsToOff(params.event_win / 1000)
        Core.fail('event window too small', event_width < 1)
        markers = fixedMarkers(rsig, markers, event_width)
        options.push(`--event-window ${params.event_win}`)
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
    if (params.sleep_win !== undefined) {
        options.push(`--sleep-window ${params.sleep_win}`)
    }
    let span = rsig.window(rsig.data.length).toMarker()
    if (params.trim) {
        [span, markers] = trimEvents(cap, markers, params.trim!)
        si = measureSleep(asig, rsig, params.sleep_win, span)
        options.push(`--trim ${params.trim}`)
    }
    Core.infoMsg(`found ${markers.length} event(s)`)
    return { span: span, events: markers, event_width: event_width, sleep: si, options: options, version: Core.version() }
}

function applyOption(params: Params, opt: string) {
    const a = opt.split(' ')
    const val = Number(a[1])
    switch (a[0]) {
        case '--event-window':
            params.event_win = val
            break
        case '--gap':
            params.gap = val
            break
        case '--min-duration':
            params.min_dur = val
            break
        case '--min-energy':
            params.min_egy = val
            break
        case '--sleep-window':
            params.sleep_win = val
            break
        case '--trim':
            params.trim = val
            break
    }
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
        last.width = (m.offset + m.width) - last.offset
    }
    return res
}

function fixedMarkers(sig: Core.Signal, markers: Core.Marker[], width: number): Core.Marker[] {
    let res = new Array<Core.Marker>()
    for (const m of markers) {
        Core.fail('event window exceeds capture duration', (m.offset + width) > sig.data.length)
        res.push({ offset: m.offset, width: width })
    }
    return res
}
function measureSleep(osig: Core.Signal, rsig: Core.Signal, sleep_win_ms: number = 500, span?: Core.Marker): Core.SleepInfo {
    let min_cur = Number.POSITIVE_INFINITY
    let std = 0
    let p95 = 0
    let off = 0
    let width = 0
    const win_wid = osig.secsToOff(sleep_win_ms / 1000)
    const sf = Math.round(rsig.sample_rate / osig.sample_rate)
    const beg = span ? Math.ceil(span.offset / sf) : 0
    const end = span ? Math.floor((span.offset + span.width) / sf) : osig.data.length
    Core.fail('sleep window too small', win_wid < 2)
    Core.fail('sleep window exceeds accounting scope', win_wid > (end - beg))
    const win = osig.window(win_wid, beg)
    while (win.valid()) {
        const m = win.toMarker()
        if ((m.offset + m.width) > end) break
        const wsig = win.toSignal()
        const cur = wsig.avg()
        if (cur < NO_CURRENT) continue
        if (cur < min_cur) {
            min_cur = cur
            std = wsig.std()
            const rm = win.scale(rsig).toMarker()
            off = rm.offset
            width = rm.width
        }
        win.slide(m.width / 2)
    }
    return { avg: min_cur, std: std, off: off, width: width }
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
