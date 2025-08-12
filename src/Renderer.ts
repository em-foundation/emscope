import * as Core from './Core'
import * as Detecter from './Detecter'
import * as Plotter from './Plotter'
import * as Writer from './Writer'

export function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const aobj = Detecter.detectEvents(cap)
    if (opts.eventInfo) {
        printEventInfo(cap, aobj.events)
    }
    if (opts.htmlPlot !== undefined) {
        const idx = (opts.htmlPlot === true) ? 0 : (opts.htmlPlot as number)
        genHtml(cap, aobj.events[idx])
    }
    if (opts.jlsFile) {
        genJls(cap, aobj.events)
    }
    if (opts.sleepInfo) {
        printSleepInfo(cap, aobj.sleep)
    }
}

function genHtml(cap: Core.Capture, event: Core.Marker) {
    Plotter.generate(cap.current_ds, event)
}

function genJls(cap: Core.Capture, markers: Core.Marker[]) {
    Writer.saveSignal(cap, `${cap.basename}--events`, cap.current_sig, markers)
}

function printEventInfo(cap: Core.Capture, markers: Core.Marker[]) {
    for (const m of markers) {
        console.log(Core.joules(cap.energyWithin(m)))
    }

}

function printSleepInfo(cap: Core.Capture, si: Core.SleepInfo) {
    console.log(`sleep current = ${Core.amps(si.avg)} @ ${cap.avg_voltage.toFixed(2)} V, std = ${Core.amps(si.std)}, p95 = ${si.p95.toExponential(2)}`)
}
