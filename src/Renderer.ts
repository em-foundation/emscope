import * as Core from './Core'

import * as Writer from './Writer'

import ChildProc from 'child_process'
import Os from 'os'
import Path from 'path'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const aobj = cap.analysis!
    const json = !!opts.json
    if (opts.whatIf !== undefined) {
        const ev_rate = (opts.whatIf === true) ? 1 : (opts.whatIf as number)
        json ? printResultsJson(cap, aobj, ev_rate) : printResults(cap, aobj, ev_rate, opts.score)
        return
    }
    if (opts.score) {
        json ? printResultsJson(cap, aobj, 1) : printResults(cap, aobj, 1, true)
        return
    }
    if (opts.eventInfo) {
        json ? printEventInfoJson(cap, aobj.events) : printEventInfo(cap, aobj.events)
        return
    }
    if (opts.jlsFile) {
        execJls(cap, aobj, opts.jlsFile === true ? '' : (opts.jlsFile as string))
        return
    }
    if (opts.sleepInfo) {
        json ? printSleepInfoJson(cap, aobj) : printSleepInfo(cap, aobj)
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
    let avg_egy = 0
    let avg_dur = 0
    let lab = 'A'
    for (const m of markers) {
        const egy = cap.energyWithin(m)
        const dur_s = cap.current_sig.offToSecs(m.width)
        avg_egy += egy * scale
        avg_dur += dur_s * scale
        const dur = (dur_s * 1000).toFixed(2).padStart(5, ' ')
        const off_s = cap.current_sig.offToSecs(m.offset).toFixed(2).padStart(5, ' ')
        Core.infoMsg(`${lab} :: time = ${off_s} s, energy = ${Core.uJoules(egy)}, duration = ${dur} ms`)
        lab = String.fromCharCode(lab.charCodeAt(0) + 1)
    }
    Core.infoMsg('----')
    Core.infoMsg(`average energy over ${markers.length} event(s): ${Core.uJoules(avg_egy)}`)
    Core.infoMsg(`average duration over ${markers.length} event(s): ${Core.toEng(avg_dur, 's')}`)
}

function printEventInfoJson(cap: Core.Capture, markers: Core.Marker[]) {
    const events = markers.map((m, i) => {
        const energy = cap.energyWithin(m)
        const duration = cap.current_sig.offToSecs(m.width)
        const time = cap.current_sig.offToSecs(m.offset)
        return {
            id: String.fromCharCode('A'.charCodeAt(0) + i),
            time,
            energy,
            duration,
        }
    })
    const totalEnergy = events.reduce((sum, e) => sum + e.energy, 0)
    const totalDuration = events.reduce((sum, e) => sum + e.duration, 0)
    const avgEnergy = events.length > 0 ? totalEnergy / events.length : 0
    const avgDuration = events.length > 0 ? totalDuration / events.length : 0
    console.log(JSON.stringify({
        type: 'event_info',
        eventCount: events.length,
        averageEnergy: avgEnergy,
        averageDuration: avgDuration,
        events,
    }))
}

function printResults(cap: Core.Capture, aobj: Core.Analysis, ev_rate: number, score_only: boolean) {
    const sleep_pwr = aobj.sleep.avg * cap.avg_voltage
    const evt_egy = averageEventEnergy(cap, aobj.events)
    const evt_dur = averageEventDuration(cap, aobj.events)
    Core.fail('event period shorter than average event duration', ev_rate < evt_dur)
    score_only || Core.infoMsg(`event period:        ${Core.secsToHms(ev_rate)}`)
    score_only || Core.infoMsg(`average sleep power:  ${Core.toEng(sleep_pwr, 'W')}`)
    score_only || Core.infoMsg(`average event energy: ${Core.uJoules(evt_egy)}`)
    score_only || Core.infoMsg(`average event duration: ${Core.toEng(evt_dur, 's')}`)
    score_only || Core.infoMsg('----')
    const egy_1c = (sleep_pwr * (ev_rate - evt_dur)) + evt_egy
    score_only || Core.infoMsg(`energy per period:    ${Core.uJoules(egy_1c)}`)
    const egy_1d = egy_1c * 86400 / ev_rate
    score_only || Core.infoMsg(`energy per day:       ${Core.joules(egy_1d)}`)
    const egy_1m = egy_1d * 30
    const ems = 2400 / egy_1m
    score_only || Core.infoMsg('----')
    Core.infoMsg(`${ems.toFixed(2)} EM•eralds`)
}

function printResultsJson(cap: Core.Capture, aobj: Core.Analysis, ev_rate: number) {
    const sleep_pwr = aobj.sleep.avg * cap.avg_voltage
    const evt_egy = averageEventEnergy(cap, aobj.events)
    const evt_dur = averageEventDuration(cap, aobj.events)
    Core.fail('event period shorter than average event duration', ev_rate < evt_dur)
    const egy_1c = (sleep_pwr * (ev_rate - evt_dur)) + evt_egy
    const egy_1d = egy_1c * 86400 / ev_rate
    const egy_1m = egy_1d * 30
    const ems = 2400 / egy_1m
    console.log(JSON.stringify({
        type: 'score',
        basis: 'events',
        emeralds: parseFloat(ems.toFixed(2)),
        cycleRate: ev_rate,
        sleepCurrent: aobj.sleep.avg,
        sleepPower: sleep_pwr,
        voltage: cap.avg_voltage,
        eventEnergy: evt_egy,
        eventDuration: evt_dur,
        energyPerCycle: egy_1c,
        energyPerDay: egy_1d,
        energyPerMonth: egy_1m,
    }))
}

function averageEventEnergy(cap: Core.Capture, markers: Core.Marker[]) {
    Core.fail('no events found', markers.length == 0)
    let total = 0
    for (const m of markers) {
        total += cap.energyWithin(m)
    }
    return total / markers.length
}

function averageEventDuration(cap: Core.Capture, markers: Core.Marker[]) {
    Core.fail('no events found', markers.length == 0)
    let total = 0
    for (const m of markers) {
        total += cap.current_sig.offToSecs(m.width)
    }
    return total / markers.length
}

function printSleepInfo(cap: Core.Capture, aobj: Core.Analysis) {
    const si = aobj.sleep
    const info = getBoundaryInfo(cap, aobj)
    Core.infoMsg(`sleep current = ${Core.uAmps(si.avg).trim()} @ ${cap.avg_voltage.toFixed(1)} V, standard deviation = ${Core.uAmps(si.std).trim()}`)
    Core.infoMsg(`sleep window = ${secs(info.sleep_window.start)} .. ${secs(info.sleep_window.end)} (${secs(info.sleep_window.duration)})`)
    Core.infoMsg(`accounting window = ${secs(info.accounting_scope.start)} .. ${secs(info.accounting_scope.end)} (${secs(info.accounting_scope.duration)})`)
    Core.infoMsg(`measured current = ${Core.uAmps(info.accounting_scope.measured_current_avg).trim()}`)
    Core.infoMsg(`modeled current = ${Core.uAmps(info.partition.modeled_current_avg).trim()}`)
    Core.infoMsg(`closure residual = ${pct(info.closure_residual)}`)
    Core.infoMsg(`floor residual = ${Core.uAmps(info.floor_residual).trim()}`)
}

function printSleepInfoJson(cap: Core.Capture, aobj: Core.Analysis) {
    const si = aobj.sleep
    const info = getBoundaryInfo(cap, aobj)
    console.log(JSON.stringify({
        type: 'sleep_info',
        sleepCurrent: si.avg,
        standardDeviation: si.std,
        voltage: cap.avg_voltage,
        sleepPower: si.avg * cap.avg_voltage,
        sleepWindow: info.sleep_window,
        accountingScope: info.accounting_scope,
        partition: info.partition,
        closureResidual: info.closure_residual,
        floorResidual: info.floor_residual,
    }))
}

function getBoundaryInfo(cap: Core.Capture, aobj: Core.Analysis) {
    const span = aobj.span
    const sl = aobj.sleep
    const sr = cap.sampling_rate
    const sl_v = cap.avg_voltage
    const sl_pwr = sl_v * sl.avg
    const evt_dur_total = aobj.events.reduce((sum, m) => sum + m.width, 0) / sr
    const span_dur = span.width / sr
    const sleep_dur = span_dur - evt_dur_total
    Core.fail('event windows exceed accounting scope', sleep_dur < 0)

    const evt_energy_total = aobj.events.reduce((sum, m) => sum + cap.energyWithin(m), 0)
    const modeled_energy = evt_energy_total + sl_pwr * sleep_dur
    const measured_energy = cap.energyWithin(span)
    const measured_power = measured_energy / span_dur
    const modeled_power = modeled_energy / span_dur
    const gap_cur = gapCurrentAvg(cap, span, aobj.events)

    return {
        sleep_window: {
            sample_offset: sl.off,
            sample_width: sl.width,
            start: sl.off / sr,
            end: (sl.off + sl.width) / sr,
            duration: sl.width / sr,
        },
        accounting_scope: {
            sample_offset: span.offset,
            sample_width: span.width,
            start: span.offset / sr,
            end: (span.offset + span.width) / sr,
            duration: span_dur,
            measured_current_avg: measured_energy / (sl_v * span_dur),
            measured_power_avg: measured_power,
        },
        partition: {
            event_count: aobj.events.length,
            event_duration_total: evt_dur_total,
            sleep_duration: sleep_dur,
            event_energy_total: evt_energy_total,
            modeled_energy,
            modeled_current_avg: modeled_energy / (sl_v * span_dur),
            modeled_power_avg: modeled_power,
        },
        closure_residual: Math.abs(modeled_power - measured_power) / Math.abs(measured_power),
        floor_residual: sl.avg - gap_cur,
    }
}

function gapCurrentAvg(cap: Core.Capture, span: Core.Marker, events: Core.Marker[]): number {
    const sorted = [...events].sort((a, b) => a.offset - b.offset)
    let off = span.offset
    let end = span.offset + span.width
    let sum = 0
    let count = 0

    for (const evt of sorted) {
        const evt_beg = Math.max(evt.offset, off)
        const evt_end = Math.min(evt.offset + evt.width, end)
        if (evt_beg > off) {
            const [s, c] = sumCurrent(cap, off, evt_beg)
            sum += s
            count += c
        }
        off = Math.max(off, evt_end)
    }

    if (off < end) {
        const [s, c] = sumCurrent(cap, off, end)
        sum += s
        count += c
    }

    Core.fail('no non-event samples found in accounting scope', count == 0)
    return sum / count
}

function sumCurrent(cap: Core.Capture, beg: number, end: number): [number, number] {
    const data = cap.current_sig.data
    let sum = 0
    let count = 0
    for (let i = beg; i < end; i++) {
        const v = data[i]
        if (!Number.isFinite(v)) continue
        sum += v
        count += 1
    }
    return [sum, count]
}

function secs(val: number): string {
    return `${val.toFixed(3)} s`
}

function pct(val: number): string {
    return `${(val * 100).toFixed(3)}%`
}
