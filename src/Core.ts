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

export interface Analysis {
    window: Marker
    events: {
        markers: Marker[]
        avg_duration: string
        avg_current: string
        avg_energy: string
    }
    energy_per_sec: string
    energy_per_day: string
    energy_per_year: string
    efficiency_score: string
}

export class Capture {

    static #LOAD_KEYS = [
        'creation_date',
        'device',
        'duration',
        'sampling_rate',
        'sample_count',
    ]

    static #SAVE_KEYS = [
        ...Capture.#LOAD_KEYS,
        'avg_voltage',
        'avg_current',
        'max_current',
        'min_current',
    ]

    _aobj: any = {}
    _current_ds?: SampleSet
    _creation_date?: Date
    _device?: CaptureDevice
    _duration?: number
    _rootdir?: string
    _sample_count?: number
    _sampling_rate?: number
    _voltage?: number
    _voltage_ds?: SampleSet

    private constructor() { }

    static create(rootdir: string, duration: number, device: CaptureDevice, voltage: number = -1): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        cap._duration = duration
        cap._device = device
        cap._voltage = voltage
        cap._creation_date = new Date()
        cap._sampling_rate = SAMPLING_RATE.get(device) ?? 0
        cap._sample_count = duration * cap.sampling_rate
        cap._current_ds = new SampleSet(cap.sample_count)
        cap._voltage_ds = new SampleSet((device == 'JS220') ? cap.sample_count : 0)
        return cap
    }

    static load(rootdir: string): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        const ytxt = Fs.readFileSync(Path.join(rootdir, 'emscope.yaml'), 'utf-8')
        const yobj = Yaml.load(ytxt) as any
        for (const k of Capture.#LOAD_KEYS) {
            (cap as any)[`_${k}`] = yobj.capture[k]
        }
        cap._aobj = yobj.analysis
        cap._current_ds = new SampleSet(cap.sample_count)
        cap.current_ds.load(rootdir, 'current')
        switch (cap.device) {
            case 'JS220':
                cap._voltage_ds = new SampleSet(cap.sample_count)
                cap.voltage_ds.load(rootdir, 'voltage')
                cap._voltage = -1
                break
            case 'PPK2':
                cap._voltage_ds = new SampleSet(0)
                cap._voltage = yobj.capture.avg_voltage
                break
        }
        return cap
    }

    get analysis() { return this._aobj as Analysis }
    get creation_date() { return this._creation_date! }
    get current_ds() { return this._current_ds! }
    get device() { return this._device! }
    get duration() { return this._duration! }
    get rootdir() { return this._rootdir! }
    get sample_count() { return this._sample_count! }
    get sampling_rate() { return this._sampling_rate! }
    get voltage() { return this._voltage! }
    get voltage_ds() { return this._voltage_ds! }

    get avg_current() { return this.current_ds.avg() }
    get max_current() { return this.current_ds.max() }
    get min_current() { return this.current_ds.min() }
    get avg_voltage() { return this.device == 'JS220' ? this.voltage_ds.avg() : this.voltage }
    bind(aobj: Analysis) {
        this._aobj = aobj
    }
    markerCharge(m: Marker): number {
        const data = this.current_ds.data.subarray(m.sample_offset, m.sample_offset + m.sample_count)
        const dt = 1 / this.sampling_rate
        return data.reduce((sum, x) => sum + x * dt, 0)
    }
    markerCurrent(m: Marker): number {
        const data = this.current_ds.data.subarray(m.sample_offset, m.sample_offset + m.sample_count)
        return data.reduce((sum, x) => sum + x, 0) / data.length
    }
    markerEnergy(m: Marker) {
        const data = this.current_ds.data.subarray(m.sample_offset, m.sample_offset + m.sample_count)
        const dt = 1 / this.sampling_rate
        return data.reduce((sum, x, idx) => sum + x * this.voltageAt(m.sample_offset + idx) * dt, 0)
    }

    sampleIndexToSecs(idx: number): number {
        return idx / this.sampling_rate
    }
    secsToSampleIndex(secs: number): number {
        return Math.round(secs * this.sampling_rate)
    }
    save() {
        this.current_ds.save(this.rootdir, 'current')
        this.voltage_ds.save(this.rootdir, 'voltage')
        const cobj = Object.fromEntries(Capture.#SAVE_KEYS.map(k => [k, (this as any)[k]]))
        const yobj = { capture: cobj, analysis: this._aobj }
        const ytxt = Yaml.dump(yobj, { indent: 4, flowLevel: 4 })
        Fs.writeFileSync(Path.join(this.rootdir, 'emscope.yaml'), ytxt)
    }
    toMarker(): Marker {
        return { sample_offset: 0, sample_count: this.sample_count }
    }
    voltageAt(offset: number): number {
        return this.device == 'JS220' ? this.voltage_ds.data[offset] : this.voltage
    }
}

export class KalmanFilter {
    q: number
    r: number
    p: number
    x: number
    constructor(
        initialEstimate: number,
        processNoise: number,
        measurementNoise: number,
        estimateCovariance: number
    ) {
        this.x = initialEstimate
        this.p = estimateCovariance
        this.q = processNoise
        this.r = measurementNoise
    }
    update(measurement: number): number {
        this.p += this.q
        const k = this.p / (this.p + this.r)  // Kalman gain
        this.x = this.x + k * (measurement - this.x) // Update estimate
        this.p = (1 - k) * this.p
        return this.x
    }
}

export class SampleSet {
    _data: Float32Array<ArrayBuffer>
    _idx = 0
    constructor(readonly size: number) {
        this._data = new Float32Array(size)
    }
    get data(): Readonly<Float32Array> { return this._data }
    get is_full(): boolean { return this._idx >= this.size }
    get length(): number { return this._idx }
    avg(): number { return this._data.reduce((sum, x) => sum + x, 0) / this.length }
    add(value: number) {
        if (!this.is_full) {
            this._data[this._idx++] = value
        }
    }
    load(dir: string, name: string) {
        const fd = Fs.openSync(Path.join(dir, `${name}.f32.bin`), 'r')
        Fs.readSync(fd, this._data, 0, this._data.length * 4, 0)
        this._idx = this._data.length
        Fs.closeSync(fd)
    }
    max(): number { return this._data.reduce((a, b) => Math.max(a, b)) }
    min(): number { return this._data.reduce((a, b) => Math.min(a, b)) }
    save(dir: string, name: string) {
        Fs.writeFileSync(Path.join(dir, `${name}.f32.bin`), this._data)
    }
}

export class Progress {
    _max = 0
    constructor(readonly prefix: string) { }
    clear() {
        process.stdout.write(`\r${' '.repeat(this._max)}\r`)
    }
    done() {
        this.clear()
        process.stdout.write(`\r${this.prefix}done.\n`)
    }
    async spin(ms: number) {
        const spinner = ['|', '/', '-', '\\']
        let i = 0
        const interval = setInterval(() => {
            process.stdout.write(`\r${this.prefix}${spinner[i++ % spinner.length]} `)
        }, 30)
        await new Promise(resolve => setTimeout(resolve, ms))
        clearInterval(interval)
        process.stdout.write('\r      ')
    }
    update(msg: string) {
        const line = `${this.prefix}${msg} ...`
        this._max = Math.max(this._max, line.length)
        process.stdout.write(`\r${line}`)
    }
}

export function avg(data: number[]): number { return data.reduce((sum, x) => sum + x, 0) / data.length }
export function stdDev(data: number[]): number {
    const mean = avg(data)
    return Math.sqrt(data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length)
}

export function decimate<T>(factor: number, data: T[]): T[] {
    return data.filter((_, i) => i % factor === 0)
}

export function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}`, [3]: ` k${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}
