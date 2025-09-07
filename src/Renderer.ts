import * as Core from './Core'
import * as Detecter from './Detecter'
import * as Writer from './Writer'

import ChildProc from 'child_process'
import Os from 'os'
import Path from 'path'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const aobj = cap.analysis ?? Detecter.analyze(cap)
    if (opts.eventInfo) {
        printEventInfo(cap, aobj.events)
        return
    }
    if (opts.jlsFile) {
        execJls(cap, aobj, opts.jlsFile === true ? '' : (opts.jlsFile as string))
        return
    }
    if (opts.sleepInfo) {
        printSleepInfo(cap, aobj.sleep)
        return
    }
    if (opts.whatIf !== undefined) {
        const ev_rate = (opts.whatIf === true) ? 1 : (opts.whatIf as number)
        printResults(cap, aobj, ev_rate, opts.score)
        return
    }
    if (opts.score) {
        printResults(cap, aobj, 1, true)
        return
    }
    Core.fail(`no options found: run 'emscope view -h'`)
}

function execJls(cap: Core.Capture, aobj: Core.Analysis, eid: string) {
    let jfile = `events`
    let span = aobj.span
    let events = aobj.events
    if (eid) {
        const eidx = eid.charCodeAt(0) - 'A'.charCodeAt(0)
        Core.fail(`event '${eid}' not found`, aobj.events[eidx] === undefined)
        const ev = aobj.events[eidx]
        const rsig = cap.current_sig
        const dur = rsig.offToSecs(ev.width)
        const wid = rsig.secsToOff(Math.ceil((dur + 2e-3) * 1000) / 1000)
        jfile = `event-${eid}`
        span = { offset: ev.offset - rsig.secsToOff(1e-3), width: wid }
        events = [ev]
    }
    const jpath = Path.join(cap.rootdir, `${jfile}.jls`)
    Writer.saveSignal(cap, jfile, span, events)
    const plat = Os.platform()
    const exe =
        plat == 'win32' ? `C:/Program Files/Joulescope/joulescope.exe` :
            plat == 'linux' ? 'joulescope_launcher' :
                plat == 'darwin' ? '/Applications/joulescope.app/Contents/MacOS/joulescope_launcher' :
                    ''
    Core.fail(`unsupported os platform: ${plat}`, exe == '')
    const p = ChildProc.spawn(exe, [jpath], { detached: true, stdio: 'ignore' })
    Core.infoMsg('launching the Joulescope File Viewer...')
    if (eid) {
        Core.infoMsg(`generated '${jfile}.png'`)
    }
    p.once('error', err => {
        Core.fail(`failed to launch Joulescope: ${err.message}`)
    })
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
        const off_s = cap.current_sig.offToSecs(m.offset).toFixed(2).padStart(5, ' ')
        Core.infoMsg(`${lab} :: time = ${off_s} s, energy = ${Core.joules(egy)}, duration = ${Core.toEng(dur_s, 's')}`)
        lab = String.fromCharCode(lab.charCodeAt(0) + 1)
    }
    Core.infoMsg('----')
    Core.infoMsg(`average energy over ${markers.length} event(s): ${Core.joules(avg)}`)
}

function printResults(cap: Core.Capture, aobj: Core.Analysis, ev_rate: number, score_only: boolean) {
    const sleep_pwr = aobj.sleep.avg * cap.avg_voltage
    score_only || Core.infoMsg(`event period: ${Core.secsToHms(ev_rate)}`)
    score_only || Core.infoMsg(`average sleep power: ${Core.toEng(sleep_pwr, 'W')}`)
    score_only || Core.infoMsg('----')
    const egy_1s = cap.energyWithin(aobj.span) / cap.current_sig.offToSecs(aobj.span.width)
    const egy_1e = egy_1s - sleep_pwr * 1
    const egy_1c = (sleep_pwr * ev_rate) + egy_1e
    score_only || Core.infoMsg(`representative event: ${Core.joules(egy_1e)}`)
    score_only || Core.infoMsg(`energy per period: ${Core.joules(egy_1c)}`)
    const egy_1d = egy_1c * 86400 / ev_rate
    score_only || Core.infoMsg(`energy per day: ${Core.joules(egy_1d)}`)
    const egy_1m = egy_1d * 30
    const ems = 2400 / egy_1m
    score_only || Core.infoMsg('----')
    Core.infoMsg(`${ems.toFixed(2)} EM•eralds`)
}

function printSleepInfo(cap: Core.Capture, si: Core.SleepInfo) {
    Core.infoMsg(`sleep current = ${Core.amps(si.avg)} @ ${cap.avg_voltage.toFixed(2)} V, standard deviation = ${Core.amps(si.std)}`)
}
