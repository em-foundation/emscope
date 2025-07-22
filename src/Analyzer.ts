import * as Core from './Core'

export class Options {
    readonly sample_rate: number = 1_000_000 // 1 MHz
    readonly event_thresh: number = 0.0001
    readonly voltage: number = 3.3
    readonly kernel_length = 20
    event_min_dt: number = 0.001 // 1 ms
    dir = '.'
    data_source = ''
    constructor(init?: Partial<Options>) {
        Object.assign(this, init)
    }
}

export function exec(cap: Core.Capture) {
    const events = findEvents(cap)
    console.log(events.length)

}

function convolve1D(input: readonly number[], kernel: number[]): number[] {
    const output = new Array(input.length + kernel.length - 1).fill(0)
    for (let i = 0; i < input.length; i++) {
        for (let j = 0; j < kernel.length; j++) {
            output[i + j] += input[i] * kernel[j]
        }
    }
    return output
}

function findEvents(cap: Core.Capture): Core.Marker[] {
    const thresh = 0.0001
    const dt = 0.001
    const min_width = Math.round(dt * cap.sampling_rate)
    let res = new Array<Core.Marker>()
    let in_event = false
    let sample_offset = 0
    const data = Array.from(cap.current_ds.data)
    const kernel = new Array(20).fill(1.0 / 20)
    convolve1D(data, kernel).forEach((val, i) => {
        if (!in_event && val >= thresh) {
            in_event = true
            sample_offset = i
        } else if (in_event && val < thresh) {
            const width = i - sample_offset
            if (width >= min_width &&
                sample_offset >= (0.5 * cap.sampling_rate) &&
                i < (cap.sample_count - 0.5 * cap.sampling_rate)
            ) {
                res.push({
                    sample_offset: sample_offset - 2 * 20,
                    sample_count: width + 3 * 20
                })
            }
            in_event = false
        }
    })
    return res
}
