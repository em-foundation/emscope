import * as Core from './Core'

const MIN_STD_DEV = 0.0001
const MIN_DURATION = .25

export async function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const data = cap.current_ds.data
    const min_samples = cap.secsToSampleIndex(MIN_DURATION)
    let hist = new Array<number>()
    let sleeping = true
    for (const [i, v] of data.entries()) {
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
                const time = Core.toEng(cap.sampleIndexToSecs(i - hist.length), 's')
                console.log(`${time}: sleep avg = ${Core.toEng(Core.avg(hist), 'A')}`)
                process.exit()
            } else {
                hist.shift()
            }
        }
    }

}
