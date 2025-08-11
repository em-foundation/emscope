import * as Core from './Core'
import * as Detecter from './Detecter'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const [events, sleep] = Detecter.detectEvents(cap)
    if (opts.eventInfo) {
        printEventInfo(cap, events)
    }
    if (opts.sleepInfo) {
        printSleepInfo(cap, sleep)
    }
}

function printEventInfo(cap: Core.Capture, markers: Core.MarkerI[]) {
    for (const m of markers) {
        console.log(Core.joules(cap.energyWithin(m)))
    }

}

function printSleepInfo(cap: Core.Capture, si: Core.SleepInfo) {
    console.log(`sleep current = ${Core.amps(si.avg)} @ ${cap.avg_voltage.toFixed(2)} V, std = ${Core.amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
}
