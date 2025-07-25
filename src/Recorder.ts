import * as Analyzer from './Analyzer'
import * as Core from './Core'
import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'
import * as Exporter from './Exporter'

export async function exec(opts: any) {
    let c: Core.Capture
    if (opts.js220) {
        c = await Driver_JS220.execCapture(opts)
    } else if (opts.ppk2) {
        c = await Driver_PPK2.execCapture(opts)
    } else {
        console.log('*** you must specify an analyzer device')
        process.exit(1)
    }
    const cap = c!
    Exporter.exec(cap)
    console.log(`    wrote 'capture.jls'`)
    Analyzer.exec(cap)
    const aobj = cap.analysis
    console.log(`    ${aobj.events.markers.length} events ==> ${aobj.efficiency_score}`)
    cap.save()
    process.exit()
}