import * as Core from './Core'
import * as Detecter from './Detecter'
import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'

export async function exec(opts: any) {
    let c: Core.Capture
    if (opts.js220) {
        if (opts.ppk2Supply) {
            const voltage = opts.ppk2Supply === true ? 3.3 : Number(opts.ppk2Supply)
            await Driver_PPK2.powerOn(voltage)
        }
        c = await Driver_JS220.execCapture(opts)
    } else if (opts.ppk2) {
        c = await Driver_PPK2.execCapture(opts)
    } else {
        Core.fail('you must specify an analyzer device')
    }
    const cap = c!
    cap.save()
    cap.bind(Detecter.analyze(cap))
    process.exit()
}