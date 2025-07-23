import * as Analyzer from './Analyzer'
import * as Core from './Core'

import JoulescopeDriver, { Value } from 'joulescope_driver'

export async function exec(opts: any) {
    const drv = new JoulescopeDriver
    const dev = drv.device_paths()[0]
    if (!dev) {
        console.error("*** no JS220 analyzer")
        drv.finalize()
        process.exit(1)
    }

    const cap = Core.Capture.create(opts.capture, opts.duration, 'JS220')

    const progress = new Core.Progress('capturing: ')

    const sampleCb = (topic: string, value: Value) => {
        if (cap.current_ds.is_full) {
            progress.done()
            Analyzer.exec(cap)
            cap.save()
            drv.publish(dev.concat('/s/i/ctrl'), 0, 0);
            drv.publish(dev.concat('/s/v/ctrl'), 0, 0);
            drv.close(dev);
            drv.finalize();
            process.exit()

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

    drv.open(dev)
    drv.publish(dev.concat("/s/i/range/mode"), "auto")
    await progress.spin(2000)
    // await new Promise(r => setTimeout(r, 2000))
    drv.subscribe(dev.concat("/s/v/!data"), 2, sampleCb)
    drv.subscribe(dev.concat("/s/i/!data"), 2, sampleCb)
    drv.publish(dev.concat("/s/i/ctrl"), 1, 0)
    drv.publish(dev.concat("/s/v/ctrl"), 1, 0)
}
