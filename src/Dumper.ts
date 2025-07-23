import * as Core from './Core'

export async function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    console.log(cap.current_ds.avg())
}