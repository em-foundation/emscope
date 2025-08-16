import * as Core from './Core'
import * as Detecter from './Detecter'
import * as Plotter from './Plotter'
import * as Writer from './Writer'

import ChildProc from 'child_process'
import Path from 'path'

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
        execJls(cap, aobj)
    }
    if (opts.sleepInfo) {
        printSleepInfo(cap, aobj.sleep)
    }
    if (opts.whatIf !== undefined) {
        const ev_rate = (opts.whatIf === true) ? 1 : (opts.whatIf as number)
        printResults(cap, aobj, ev_rate)
    }
}


function genHtml(cap: Core.Capture, event: Core.Marker) {
    Plotter.generate(cap.current_ds, event)
}

function execJls(cap: Core.Capture, aobj: Core.Analysis) {
    const jfile = `${cap.basename}--events`
    const jpath = Path.join(cap.rootdir, `${jfile}.jls`)
    Writer.saveSignal(cap, jfile, aobj.span, aobj.events)
    const exe = `C:/Program Files/Joulescope/joulescope.exe`
    const p = ChildProc.spawn(exe, [jpath], { detached: true, stdio: 'ignore' })
    p.unref()
}

function printEventInfo(cap: Core.Capture, markers: Core.Marker[]) {
    const scale = 1 / markers.length
    let avg = 0
    let lab = 'A'
    for (const m of markers) {
        const egy = cap.energyWithin(m)
        avg += egy * scale
        const dur = (cap.current_sig.offToSecs(m.width) * 1000).toFixed(3).padStart(7, ' ')
        const dur_s = cap.current_sig.offToSecs(m.width)
        Core.infoMsg(`${lab} :: ${Core.joules(egy)}, ${Core.toEng(dur_s, 's')}`)
        lab = String.fromCharCode(lab.charCodeAt(0) + 1)
    }
    Core.infoMsg('----')
    Core.infoMsg(`average energy over ${markers.length} event(s): ${Core.joules(avg)}`)
}

function printResults(cap: Core.Capture, aobj: Core.Analysis, ev_rate: number) {
    const sleep_pwr = aobj.sleep.avg * cap.avg_voltage
    Core.infoMsg(`average sleep power: ${Core.toEng(sleep_pwr, 'W')}`)
    Core.infoMsg(`event cycle rate: ${ev_rate} s`)
    Core.infoMsg('----')
    const egy_1s = cap.energyWithin(aobj.span) / cap.current_sig.offToSecs(aobj.span.width)
    const egy_1e = egy_1s - sleep_pwr * 1
    const egy_1c = (sleep_pwr * ev_rate) + egy_1e
    Core.infoMsg(`representative event: ${Core.joules(egy_1e)}`)
    Core.infoMsg(`energy per cycle: ${Core.joules(egy_1c)}`)
    const egy_1d = egy_1c * 86400 / ev_rate
    Core.infoMsg(`energy per day: ${Core.joules(egy_1d)}`)
    const egy_1m = egy_1d * 30
    const ems = 2400 / egy_1m
    Core.infoMsg('----')
    Core.infoMsg(`${ems.toFixed(2)} EM•eralds`)
}

function printSleepInfo(cap: Core.Capture, si: Core.SleepInfo) {
    Core.infoMsg(`sleep current = ${Core.amps(si.avg)} @ ${cap.avg_voltage.toFixed(2)} V, std = ${Core.amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
}

function spawnJoulescope(file: string) {
    const exe = `C:Program Files/Joulescope/joulescope.exe`
    const p = ChildProc.spawn(exe, [])

}


