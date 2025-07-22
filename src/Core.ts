import Fs from 'fs'
import Path from 'path'
import Yaml from 'js-yaml'

export type CaptureDevice = 'JS220' | 'PPK2'

export const SAMPLING_RATE = new Map<CaptureDevice, number>([
    ['JS220', 1_000_000],
    ['PPK2', 100_000],
])

export interface Marker {
    sample_offset: number
    sample_count: number
}

export class Capture {
    static #INFO_KEYS = [
        'creation_date',
        'device',
        'duration',
        'sampling_rate',
        'sample_count',
        'avg_voltage',
        'avg_current',
        'max_current',
        'min_current',
    ]
    readonly creation_date: Date
    readonly sampling_rate: number
    readonly sample_count: number
    readonly current_ds: SampleSet
    readonly voltage_ds: SampleSet
    constructor(
        readonly rootdir: string,
        readonly duration: number,
        readonly device: CaptureDevice,
        readonly voltage: number = -1) {
        this.creation_date = new Date()
        this.sampling_rate = SAMPLING_RATE.get(device) ?? 0
        this.sample_count = duration * this.sampling_rate
        this.current_ds = new SampleSet(this.sample_count)
        this.voltage_ds = new SampleSet((device == 'JS220') ? this.sample_count : 0)
    }
    get avg_current() { return this.current_ds.avg() }
    get max_current() { return this.current_ds.max() }
    get min_current() { return this.current_ds.min() }
    get avg_voltage() { return this.device == 'JS220' ? this.voltage_ds.avg() : this.voltage }
    save() {
        this.current_ds.save(this.rootdir, 'current')
        this.voltage_ds.save(this.rootdir, 'voltage')
        const cobj = Object.fromEntries(Capture.#INFO_KEYS.map(k => [k, (this as any)[k]]))
        const ytxt = Yaml.dump({ capture: cobj })
        Fs.writeFileSync(Path.join(this.rootdir, 'emflux.yaml'), ytxt)
    }
}

export class SampleSet {
    #data: Float32Array<ArrayBuffer>
    #idx = 0
    constructor(readonly size: number) {
        this.#data = new Float32Array(size)
    }
    get data(): Readonly<Float32Array> { return this.#data }
    get is_full(): boolean { return this.#idx >= this.size }
    get length(): number { return this.#idx }
    avg(): number { return this.#data.reduce((sum, x) => sum + x, 0) / this.length }
    add(value: number) {
        if (!this.is_full) {
            this.#data[this.#idx++] = value
        }
    }
    max(): number { return this.#data.reduce((a, b) => Math.max(a, b)) }
    min(): number { return this.#data.reduce((a, b) => Math.min(a, b)) }
    save(dir: string, name: string) {
        Fs.writeFileSync(Path.join(dir, `${name}.f32.bin`), this.#data)
    }
}

export class Progress {
    #max = 0
    constructor(readonly prefix: string) { }
    done() {
        process.stdout.write(`\r${' '.repeat(this.#max)}`)
        process.stdout.write(`\r${this.prefix} done.\n`)
    }
    async spin(ms: number) {
        const spinner = ['|', '/', '-', '\\']
        let i = 0
        const interval = setInterval(() => {
            process.stdout.write(`\r${this.prefix} ${spinner[i++ % spinner.length]} `)
        }, 30)
        await new Promise(resolve => setTimeout(resolve, ms))
        clearInterval(interval)
        process.stdout.write('\r      ')
    }
    update(msg: string) {
        const line = `${this.prefix} ${msg} ...`
        this.#max = Math.max(this.#max, line.length)
        process.stdout.write(`\r${line}`)
    }
}

export function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}
