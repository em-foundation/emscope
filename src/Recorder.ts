import * as Core from './Core'
import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'

export async function exec(opts: any) {
    let c: Core.Capture
    if (opts.js220) {
        c = await Driver_JS220.execCapture(opts)
    } else if (opts.ppk2) {
        c = await Driver_PPK2.execCapture(opts)
    } else {
        Core.fail('you must specify an analyzer device')
    }
    const cap = c!
    cap.save()
    process.exit()
}