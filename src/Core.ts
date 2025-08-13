import Fs from 'fs'
import Path from 'path'
import Yaml from 'js-yaml'

export type Analysis = { span: Marker, events: Marker[], sleep: SleepInfo }
export type CaptureDevice = 'JS220' | 'PPK2'
export type F32 = Float32Array<ArrayBufferLike>
export type Marker = { offset: number, width: number }
export type MinMaxMeanBin = [number, number, number]
export type SleepInfo = { avg: number, std: number, p95: number, off: number }

const TAB = '    '

export class Capture {

    static #AFILE = 'analysis.yaml'
    static #CFILE = 'capture.yaml'

    static #SAMPLING_RATE = new Map<CaptureDevice, number>([
        ['JS220', 1_000_000],
        ['PPK2', 100_000],
    ])

    static #LOAD_KEYS = [
        'creation_date',
        'device',
        'duration',
        'sampling_rate',
        'sample_count',
    ]

    static #SAVE_KEYS = [
        ...Capture.#LOAD_KEYS,
    ]

    private _aobj?: Analysis
    private _current_ds?: SampleSet
    private _creation_date?: Date
    private _device?: CaptureDevice
    private _duration?: number
    private _rootdir?: string
    private _sample_count?: number
    private _sampling_rate?: number
    private _voltage?: number
    private _voltage_ds?: SampleSet

    private constructor() { }

    static create(rootdir: string, duration: number, device: CaptureDevice, voltage: number = -1): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        cap._duration = duration
        cap._device = device
        cap._voltage = voltage
        cap._creation_date = new Date()
        cap._sampling_rate = Capture.#SAMPLING_RATE.get(device) ?? 0
        cap._sample_count = duration * cap.sampling_rate
        cap._current_ds = new SampleSet(cap.sample_count)
        cap._voltage_ds = new SampleSet((device == 'JS220') ? cap.sample_count : 0)
        return cap
    }

    static load(rootdir: string): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        const ytxt = Fs.readFileSync(cap.#cpath, 'utf-8')
        const yobj = Yaml.load(ytxt) as any
        for (const k of Capture.#LOAD_KEYS) {
            (cap as any)[`_${k}`] = yobj.capture[k]
        }
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
        if (Fs.existsSync(cap.#apath)) {
            cap._aobj = Yaml.load(Fs.readFileSync(cap.#apath, 'utf-8')) as Analysis
        }
        return cap
    }

    get #apath() { return Path.join(this.rootdir, Capture.#AFILE) }
    get #cpath() { return Path.join(this.rootdir, Capture.#CFILE) }

    get analysis() { return this._aobj }
    get avg_voltage() { return this.voltage == -1 ? this.voltage_sig.avg() : this.voltage }
    get basename() { return Path.basename(Path.resolve(this.rootdir)) }
    get creation_date() { return this._creation_date! }
    get current_ds() { return this._current_ds! }
    get current_sig() { return new Signal(this.current_ds.data, this.sampling_rate) }
    get device() { return this._device! }
    get duration() { return this._duration! }
    get rootdir() { return this._rootdir! }
    get sample_count() { return this._sample_count! }
    get sampling_rate() { return this._sampling_rate! }
    get voltage() { return this._voltage! }
    get voltage_ds() { return this._voltage_ds! }
    get voltage_sig() { return new Signal(this.voltage_ds.data, this.sampling_rate) }

    bind(aobj: Analysis) {
        this._aobj = aobj
        const ytxt = Yaml.dump(aobj, { indent: 4, flowLevel: 4 })
        Fs.writeFileSync(this.#apath, ytxt)
        infoMsg(`wrote '${Capture.#AFILE}'`)
    }
    energyWithin(m: Marker): number {
        const dt = 1 / this.sampling_rate
        const data = this.current_ds.data
        let sum = 0
        let off = m.offset
        for (let i = 0; i < m.width; i++) {
            sum += data[off] * this.voltageAt(off) * dt
            off += 1
        }
        return sum
    }
    save() {
        Fs.rmSync(this.#apath, { force: true })
        this.current_ds.save(this.rootdir, 'current')
        this.voltage_ds.save(this.rootdir, 'voltage')
        const cobj = Object.fromEntries(Capture.#SAVE_KEYS.map(k => [k, (this as any)[k]]))
        const yobj = { capture: cobj }
        const ytxt = Yaml.dump(yobj, { indent: 4, flowLevel: 4 })
        Fs.writeFileSync(this.#cpath, ytxt)
        infoMsg(`wrote '${Capture.#CFILE}'`)
    }
    voltageAt(offset: number): number {
        return this.voltage == -1 ? this.voltage_ds.data[offset] : this.voltage
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

export class Progress {
    #max = 0
    #pre = TAB
    constructor(prefix: string) {
        this.#pre += prefix
    }
    clear() {
        process.stdout.write(`\r${' '.repeat(this.#max)}\r`)
    }
    done() {
        this.clear()
        process.stdout.write(`\r${this.#pre}done.\n`)
    }
    async spin(ms: number) {
        const spinner = ['|', '/', '-', '\\']
        let i = 0
        const interval = setInterval(() => {
            process.stdout.write(`\r${this.#pre}${spinner[i++ % spinner.length]} `)
        }, 30)
        await new Promise(resolve => setTimeout(resolve, ms))
        clearInterval(interval)
        process.stdout.write('\r      ')
    }
    update(msg: string) {
        const line = `${this.#pre}${msg} ...`
        this.#max = Math.max(this.#max, line.length)
        process.stdout.write(`\r${line}`)
    }
}

export class SampleSet {
    #data: F32
    #idx = 0
    constructor(readonly size: number) {
        this.#data = new Float32Array(size)
    }
    get data(): Readonly<F32> { return this.#data }
    get is_full(): boolean { return this.#idx >= this.size }
    get length(): number { return this.#idx }
    add(value: number) {
        if (!this.is_full) {
            this.#data[this.#idx++] = value
        }
    }
    load(dir: string, name: string) {
        const fd = Fs.openSync(Path.join(dir, `${name}.f32.bin`), 'r')
        Fs.readSync(fd, this.#data, 0, this.#data.length * 4, 0)
        this.#idx = this.#data.length
        Fs.closeSync(fd)
    }
    save(dir: string, name: string) {
        Fs.writeFileSync(Path.join(dir, `${name}.f32.bin`), this.#data)
    }
}

export class Signal {
    constructor(readonly data: F32, readonly sample_rate: number) { }
    avg(): number {
        return this.data.reduce((sum, x) => sum + x, 0) / this.data.length
    }
    bin3M(width: number): Array<MinMaxMeanBin> {
        let res = new Array<MinMaxMeanBin>()
        const INIT = [width, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0]
        let [cnt, min, max, sum] = INIT
        for (const v of this.data) {
            min = Math.min(min, v)
            max = Math.max(max, v)
            sum += v
            if (--cnt > 0) continue
            res.push([min, max, sum / width])
            { [cnt, min, max, sum] = INIT }
        }
        return res
    }
    integral(): number {
        const dt = 1 / this.sample_rate
        return this.data.reduce((sum, v) => sum + v * dt, 0)
    }
    mapMean(width: number): Signal {
        const bins = this.bin3M(width)
        const f32 = new Float32Array(bins.map(b => b[2]))
        return new Signal(f32, this.sample_rate / width)
    }
    max(): number {
        return this.data.reduce((a, b) => Math.max(a, b))
    }
    min(): number {
        return this.data.reduce((a, b) => Math.min(a, b))
    }
    offToSecs(idx: number): number {
        return idx > 0 ? idx / this.sample_rate : 0
    }
    secsToOff(secs: number): number {
        return Math.round(secs * this.sample_rate)
    }
    std(): number {
        const mean = this.avg()
        let sum_sq = 0
        for (const x of this.data) {
            const d = x - mean
            sum_sq += d * d
        }
        return Math.sqrt(sum_sq / this.data.length)
    }
    slope_p95(): number {
        const slope = new Array<number>()
        for (let i = 1; i < this.data.length; i++) {
            slope.push(Math.abs(this.data[i] - this.data[i - 1]))
        }
        const sorted = [...slope].sort((a, b) => a - b)
        const p95 = sorted[Math.floor(0.95 * sorted.length)]
        return p95
    }
    window(width: number, offset: number = 0): Window {
        return new Window(this, offset, width)
    }
}

class Window {
    #sig: Signal
    #off: number
    #wid: number
    constructor(sig: Signal, off: number, wid: number) {
        this.#sig = sig
        this.#off = off
        this.#wid = wid
    }
    get marker(): Marker { return { offset: this.#off, width: this.#wid } }
    get offset() { return this.#off }
    get width() { return this.#wid }
    scale(osig: Signal): Window {
        const sf = Math.round(osig.sample_rate / this.#sig.sample_rate)
        return osig.window(this.#wid * sf, this.#off * sf)
    }
    slide(count: number) {
        this.#off += count
    }
    toSignal(): Signal {
        return new Signal(this.#sig.data.subarray(this.#off, this.#off + this.#wid), this.#sig.sample_rate)
    }
    valid(): boolean {
        return this.#off >= 0 && (this.#off + this.#wid) <= this.#sig.data.length
    }
}

export function amps(val: number): string {
    return toEng(val, 'A')
}

export function decimate<T>(factor: number, data: T[]): T[] {
    return data.filter((_, i) => i % factor === 0)
}

export function infoMsg(msg: string) {
    console.log(`${TAB}${msg}`)
}

export function joules(j: number): string {
    return toEng(j, 'J')
}

export function toEng(x: number, u: string): string {
    if (x == 0) return `0 ${u}`
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}`, [3]: ` k${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}


