import * as Core from './Core'

const ALGS = [alg0, alg1]

export async function exec(opts: any) {
    const alg_num = opts.algorithmNumber
    if (alg_num >= ALGS.length) {
        console.log('*** algorithm number out of range')
        process.exit(1)
    }
    const cap = Core.Capture.load(opts.capture)
    ALGS[alg_num](cap)
}

function alg0(cap: Core.Capture) {
    const ev0 = cap.analysis.events.markers[0]
    const m: Core.Marker = {
        sample_offset: ev0.sample_offset - cap.secsToSampleIndex(.40),
        sample_count: cap.secsToSampleIndex(.25)
    }
    const sleep_data = cap.markerArray(m)
    Core.avg(sleep_data)
    console.log(`sleep current = ${Core.toEng(Core.avg(sleep_data), 'A')}, std = ${Core.toEng(Core.stdDev(sleep_data), 'A')}`)
    // const pre = 50
    // const data = cap.current_ds.data.subarray(ev0.sample_offset - pre, ev0.sample_offset)
    // for (const [i, v] of data.entries()) {
    //     console.log(`${i - pre}: ${Core.toEng(v, 'A')}`)
    // }
    console.log(ev0)
}
function alg1(cap: Core.Capture) {

    const MIN_STD_DEV = 0.0001
    const MIN_DURATION = .25

    const data = cap.current_ds.data
    const min_samples = cap.secsToSampleIndex(MIN_DURATION)
    let hist = new Array<number>()
    let sleeping = true
    const pre = 100
    for (const [i, v] of data.subarray(pre).entries()) {
        hist.push(v)
        if (sleeping) {
            const sd = Core.stdDev(hist)
            if (sd < MIN_STD_DEV) {
                sleeping = false
            }
            continue
        }
        if (hist.length >= min_samples) {
            const sd = Core.stdDev(hist)
            if (sd < MIN_STD_DEV) {
                const time = Core.toEng(cap.sampleIndexToSecs(pre + i + 1 - hist.length), 's')
                console.log(`${time}: sleep avg = ${Core.toEng(Core.avg(hist), 'A')}`)
                process.exit()
            } else {
                hist.shift()
            }
        }
    }
}
