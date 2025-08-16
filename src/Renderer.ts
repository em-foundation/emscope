import * as Core from './Core'
import * as Detecter from './Detecter'
import * as Plotter from './Plotter'
import * as Writer from './Writer'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const aobj = cap.analysis ?? Detecter.analyze(cap)
    if (opts.eventInfo) {
        printEventInfo(cap, aobj.events)
    }
    if (opts.htmlPlot !== undefined) {
        const idx = (opts.htmlPlot === true) ? 0 : (opts.htmlPlot as number)
        genHtml(cap, aobj.events[idx])
    }
    if (opts.jlsFile) {
        genJls(cap, aobj)
    }
    if (opts.sleepInfo) {
        printSleepInfo(cap, aobj.sleep)
    }
    if (opts.whatIf !== undefined) {
        const ev_rate = (opts.whatIf === true) ? 1 : (opts.whatIf as number)
        if (ev_rate == 1) {
            printDefResults(cap, aobj)
        } else {
            printExtResults(cap, aobj, ev_rate)
        }
    }
}

function genHtml(cap: Core.Capture, event: Core.Marker) {
    Plotter.generate(cap.current_ds, event)
}

function genJls(cap: Core.Capture, aobj: Core.Analysis) {
    Writer.saveSignal(cap, `${cap.basename}--events`, aobj.span, aobj.events)
}

function printEventInfo(cap: Core.Capture, markers: Core.Marker[]) {
    const scale = 1 / markers.length
    let avg = 0
    let lab = 'A'
    for (const m of markers) {
        const egy = cap.energyWithin(m)
        avg += egy * scale
        const dur = (cap.current_sig.offToSecs(m.width) * 1000).toFixed(3).padStart(6, ' ')
        Core.infoMsg(`${lab} -- ${Core.joules(egy)}, ${dur} ms`)
        lab = String.fromCharCode(lab.charCodeAt(0) + 1)
    }
    Core.infoMsg('----')
    Core.infoMsg(`average energy over ${markers.length} event(s): ${Core.joules(avg)}`)
}

function printCycleRate(ev_rate: number) {
    Core.infoMsg(`event cycle rate: ${ev_rate} seconds`)
    Core.infoMsg('----')
}

function printExtResults(cap: Core.Capture, aobj: Core.Analysis, ev_rate: number) {
    const scale = 1 / aobj.events.length
    let egy_avg = 0
    let wid_avg = 0
    for (const m of aobj.events) {
        egy_avg += cap.energyWithin(m) * scale
        wid_avg += m.width * scale
    }
    const sleep_time = (ev_rate - (wid_avg / cap.sampling_rate))
    const sleep_egy = (aobj.sleep.avg * cap.avg_voltage * sleep_time)
    const egy_1c = sleep_egy + egy_avg
    printCycleRate(ev_rate)
    Core.infoMsg(`energy per cycle: ${Core.joules(egy_1c)}`)
    printScores(egy_1c * 86400 / ev_rate)
}

function printDefResults(cap: Core.Capture, aobj: Core.Analysis) {
    const egy_1s = cap.energyWithin(aobj.span) / aobj.events.length
    Core.infoMsg(`energy per second: ${Core.joules(egy_1s)}`)
    printScores(egy_1s * 86400)
}

function printScores(egy_1d: number) {
    Core.infoMsg(`energy per day: ${Core.joules(egy_1d)}`)
    const egy_1m = egy_1d * 30
    const ems = 2400 / egy_1m
    Core.infoMsg('----')
    Core.infoMsg(`${ems.toFixed(2)} EM•eralds`)
}

function printSleepInfo(cap: Core.Capture, si: Core.SleepInfo) {
    Core.infoMsg(`sleep current = ${Core.amps(si.avg)} @ ${cap.avg_voltage.toFixed(2)} V, std = ${Core.amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
}
