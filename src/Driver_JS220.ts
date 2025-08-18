import * as Core from './Core'

import JoulescopeDriver, { Value } from 'joulescope_driver'

export async function execCapture(opts: any): Promise<Core.Capture> {

    const cap = Core.Capture.create(opts.capture, opts.duration, 'JS220')
    const progress = new Core.Progress('capturing: ')
    const drv = new JoulescopeDriver
    const dev = drv.device_paths()[0]
    let resolve_capture: (cap: Core.Capture) => void

    const sampleCb = (topic: string, value: Value) => {
        if (cap.current_ds.is_full) {
            progress.clear()
            drv.publish(dev.concat('/s/i/ctrl'), 0, 0)
            drv.publish(dev.concat('/s/v/ctrl'), 0, 0)
            drv.close(dev)
            drv.finalize()
            resolve_capture(cap)
            return
        }
        if (topic.indexOf('/s/i/') != -1) {
            progress.update(`${(cap.current_ds.length / 1_000_000).toFixed(3)} s`)
            for (const v of value.data) {
                cap.current_ds.add(v)
            }
            return
        }
        if (topic.indexOf('/s/v/') != -1) {
            for (const v of value.data) {
                cap.voltage_ds.add(v)
            }
            return
        }
    }
    if (!dev) {
        console.error("*** no JS220 analyzer")
        drv.finalize()
        process.exit(1)
    }

    drv.open(dev)
    drv.publish(dev.concat("/s/i/range/mode"), "auto")
    await progress.spin(3000)
    drv.subscribe(dev.concat("/s/v/!data"), 2, sampleCb)
    drv.subscribe(dev.concat("/s/i/!data"), 2, sampleCb)
    drv.publish(dev.concat("/s/i/ctrl"), 1, 0)
    drv.publish(dev.concat("/s/v/ctrl"), 1, 0)

    return new Promise<Core.Capture>(resolve => {
        resolve_capture = resolve
    })
}
