import Fs from 'fs'
import Path from 'path'
import Yaml from 'js-yaml'

export type Analysis = { span: Marker, events: Marker[], event_width?: number, sleep: SleepInfo, options: string[], version: string }
export type CaptureDevice = 'JS220' | 'Otii3' | 'PPK2'
export type F32 = Float32Array<ArrayBufferLike>
export type Marker = { offset: number, width: number }
export type EventStats = {
    count: number
    duration_avg: number
    duration_std: number
    energy_avg: number
    energy_std: number
}
export type BoundaryInfo = {
    event_window: {
        count: number
        sample_width?: number
        duration?: number
        first_sample_offset: number
        last_sample_end: number
        duration_total: number
        duration_avg: number
        duration_std: number
    }
    sleep_window: {
        sample_offset: number
        sample_width: number
        start: number
        end: number
        duration: number
    }
    accounting_scope: {
        sample_offset: number
        sample_width: number
        start: number
        end: number
        duration: number
        measured_current_avg: number
        measured_power_avg: number
    }
    partition: {
        event_count: number
        event_duration_total: number
        sleep_duration: number
        event_energy_total: number
        modeled_energy: number
        modeled_power_avg: number
    }
    closure_residual: number
    floor_residual: number
}
export type MinMaxMeanBin = [number, number, number]
export type SleepInfo = { avg: number, std: number, off: number, width: number }

const TAB = '    '

export class Capture {

    static #AFILE = 'analysis.yaml'
    static #CFILE = 'capture.yaml'

    static #SAMPLING_RATE = new Map<CaptureDevice, number>([
        ['JS220', 1_000_000],
        ['Otii3', 50_000],
        ['PPK2', 100_000],
    ])

    static #LOAD_KEYS = [
        'creation_date',
        'device',
        'duration',
        'sampling_rate',
        'sample_count',
        'version',
        'voltage',
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
    private _version?: string
    private _voltage?: number
    private _voltage_ds?: SampleSet

    private constructor() { }

    static create(rootdir: string, duration: number, device: CaptureDevice, voltage: number = -1): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        cap._duration = duration
        cap._device = device
        cap._version = version()
        cap._voltage = voltage
        cap._creation_date = new Date()
        cap._sampling_rate = Capture.#SAMPLING_RATE.get(device) ?? 0
        cap._sample_count = duration * cap.sampling_rate
        cap._current_ds = new SampleSet(cap.sample_count)
        cap._voltage_ds = new SampleSet((device == 'PPK2') ? 0 : cap.sample_count)
        const wd = cap.#workdir
        if (Fs.existsSync(wd)) {
            Fs.rmSync(wd, { recursive: true })
        }
        Fs.mkdirSync(wd)
        return cap
    }

    static load(rootdir: string): Capture {
        let cap = new Capture()
        cap._rootdir = rootdir
        fail(`captured data not found locally, try running 'emscope pack -u'`, !Fs.existsSync(Capture.workdir(rootdir)))
        const ytxt = Fs.readFileSync(cap.#cpath, 'utf-8')
        const yobj = Yaml.load(ytxt) as any
        for (const k of Capture.#LOAD_KEYS) {
            (cap as any)[`_${k}`] = yobj.capture[k]
        }
        cap._current_ds = new SampleSet(cap.sample_count)
        cap.current_ds.load(cap.#workdir, 'current')
        switch (cap.device) {
            case 'JS220':
            case 'Otii3':
                cap._voltage_ds = new SampleSet(cap.sample_count)
                cap.voltage_ds.load(cap.#workdir, 'voltage')
                break
            case 'PPK2':
                cap._voltage_ds = new SampleSet(0)
                break
        }
        if (Fs.existsSync(cap.#apath)) {
            cap._aobj = Yaml.load(Fs.readFileSync(cap.#apath, 'utf-8')) as Analysis
        }
        return cap
    }

    static workdir(rootdir: string): string {
        return Path.join(rootdir, '.emscope')
    }

    get #apath() { return Path.join(this.rootdir, Capture.#AFILE) }
    get #cpath() { return Path.join(this.rootdir, Capture.#CFILE) }

    get #workdir() { return Path.join(this.rootdir, '.emscope') }

    get analysis() { return this._aobj }
    get avg_voltage() {
        if (this.voltage != -1) return this.voltage
        let count = 0
        let sum = 0
        for (const v of this.voltage_sig.data) {
            if (!Number.isFinite(v) || v <= 0) continue
            count += 1
            sum += v
        }
        fail('no valid voltage samples found', count == 0)
        return sum / count
    }
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
    validateBoundaryAnalysis(aobj: Analysis = this.analysis!) {
        fail(`no prior analysis: run 'emscope scan ...'`, aobj === undefined)
        fail(`legacy analysis.yaml lacks boundary metadata; run 'emscope scan --refresh'`, versionLessThan(aobj.version, '26.1.0'))
        fail(`legacy analysis.yaml lacks boundary metadata; run 'emscope scan --refresh'`, aobj.sleep?.width === undefined)
        fail(`legacy analysis.yaml lacks boundary metadata; run 'emscope scan --refresh --event-window <ms>'`, aobj.event_width === undefined)
    }
    boundaryInfo(aobj: Analysis = this.analysis!): BoundaryInfo {
        this.validateBoundaryAnalysis(aobj)
        const evt_stats = this.eventStats(aobj.events)
        const span = aobj.span
        const sl = aobj.sleep
        const sr = this.sampling_rate
        const sl_avg = sl.avg
        const sl_v = this.avg_voltage
        const sl_pwr = sl_v * sl_avg
        const evt_dur_total = aobj.events.reduce((sum, m) => sum + m.width, 0) / sr
        const span_dur = span.width / sr
        const sleep_dur = span_dur - evt_dur_total
        fail('event windows exceed accounting scope', sleep_dur < 0)

        const evt_energy_total = aobj.events.reduce((sum, m) => sum + this.energyWithin(m), 0)
        const modeled_energy = evt_energy_total + sl_pwr * sleep_dur
        const measured_energy = this.energyWithin(span)
        const measured_power = measured_energy / span_dur
        const modeled_power = modeled_energy / span_dur
        const gap_cur = this.gapCurrentAvg(span, aobj.events)

        return {
            event_window: {
                count: evt_stats.count,
                sample_width: aobj.event_width,
                duration: aobj.event_width === undefined ? undefined : aobj.event_width / sr,
                first_sample_offset: Math.min(...aobj.events.map(m => m.offset)),
                last_sample_end: Math.max(...aobj.events.map(m => m.offset + m.width)),
                duration_total: evt_dur_total,
                duration_avg: evt_stats.duration_avg,
                duration_std: evt_stats.duration_std,
            },
            sleep_window: {
                sample_offset: sl.off,
                sample_width: sl.width,
                start: sl.off / sr,
                end: (sl.off + sl.width) / sr,
                duration: sl.width / sr,
            },
            accounting_scope: {
                sample_offset: span.offset,
                sample_width: span.width,
                start: span.offset / sr,
                end: (span.offset + span.width) / sr,
                duration: span_dur,
                measured_current_avg: measured_energy / (sl_v * span_dur),
                measured_power_avg: measured_power,
            },
            partition: {
                event_count: evt_stats.count,
                event_duration_total: evt_dur_total,
                sleep_duration: sleep_dur,
                event_energy_total: evt_energy_total,
                modeled_energy,
                modeled_power_avg: modeled_power,
            },
            closure_residual: Math.abs(modeled_power - measured_power) / Math.abs(measured_power),
            floor_residual: sl_avg - gap_cur,
        }
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
    eventStats(markers: Marker[]): EventStats {
        fail('no events found', markers.length == 0)

        const durations = markers.map(m => m.width / this.sampling_rate)
        const energies = markers.map(m => this.energyWithin(m))
        const duration_avg = mean(durations)
        const energy_avg = mean(energies)

        return {
            count: markers.length,
            duration_avg,
            duration_std: std(durations, duration_avg),
            energy_avg,
            energy_std: std(energies, energy_avg),
        }
    }
    gapCurrentAvg(span: Marker, events: Marker[]): number {
        const sorted = [...events].sort((a, b) => a.offset - b.offset)
        let off = span.offset
        let end = span.offset + span.width
        let sum = 0
        let count = 0

        for (const evt of sorted) {
            const evt_beg = Math.max(evt.offset, off)
            const evt_end = Math.min(evt.offset + evt.width, end)
            if (evt_beg > off) {
                const [s, c] = this.sumCurrent(off, evt_beg)
                sum += s
                count += c
            }
            off = Math.max(off, evt_end)
        }

        if (off < end) {
            const [s, c] = this.sumCurrent(off, end)
            sum += s
            count += c
        }

        fail('no non-event samples found in accounting scope', count == 0)
        return sum / count
    }
    save() {
        Fs.rmSync(this.#apath, { force: true })
        this.current_ds.save(this.#workdir, 'current')
        this.voltage_ds.save(this.#workdir, 'voltage')
        const cobj = Object.fromEntries(Capture.#SAVE_KEYS.map(k => [k, (this as any)[k]]))
        const yobj = { capture: cobj }
        const ytxt = Yaml.dump(yobj, { indent: 4, flowLevel: 4 })
        Fs.writeFileSync(this.#cpath, ytxt)
        infoMsg(`wrote '${Capture.#CFILE}'`)
    }
    sumCurrent(beg: number, end: number): [number, number] {
        const data = this.current_sig.data
        let sum = 0
        let count = 0
        for (let i = beg; i < end; i++) {
            const v = data[i]
            if (!Number.isFinite(v)) continue
            sum += v
            count += 1
        }
        return [sum, count]
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
    scale(osig: Signal): Window {
        const sf = Math.round(osig.sample_rate / this.#sig.sample_rate)
        return osig.window(this.#wid * sf, this.#off * sf)
    }
    slide(count: number) {
        this.#off += count
    }
    toMarker(): Marker {
        return { offset: this.#off, width: this.#wid }
    }
    toSignal(): Signal {
        return new Signal(this.#sig.data.subarray(this.#off, this.#off + this.#wid), this.#sig.sample_rate)
    }
    valid(): boolean {
        return this.#off >= 0 && (this.#off + this.#wid) <= this.#sig.data.length
    }
}

export function decimate<T>(factor: number, data: T[]): T[] {
    return data.filter((_, i) => i % factor === 0)
}

export function fail(msg: string, cond: boolean = true) {
    if (cond) {
        console.log(`*** ${msg} ***`)
        process.exit(1)
    }
}

export function findConfig(): any {
    let dir = process.cwd()
    let fpath = ""
    while (true) {
        const full = Path.join(dir, 'emscope-local.json')
        if (Fs.existsSync(full)) {
            fpath = full
            break
        }
        const parent = Path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return fpath === "" ? undefined : JSON.parse(Fs.readFileSync(fpath, 'utf-8'))
}

export function infoMsg(msg: string) {
    console.log(`${TAB}${msg}`)
}

export function joules(j: number): string {
    return toEng(j, 'J', 0)
}

function versionLessThan(a: string, b: string): boolean {
    const aa = a.split('.').map(Number)
    const bb = b.split('.').map(Number)
    const n = Math.max(aa.length, bb.length)
    for (let i = 0; i < n; i++) {
        const av = aa[i] ?? 0
        const bv = bb[i] ?? 0
        if (av < bv) return true
        if (av > bv) return false
    }
    return false
}

function mean(data: number[]): number {
    return data.reduce((sum, x) => sum + x, 0) / data.length
}

function std(data: number[], avg: number): number {
    let sum_sq = 0
    for (const x of data) {
        const d = x - avg
        sum_sq += d * d
    }
    return Math.sqrt(sum_sq / data.length)
}

export function parseHms(s: string): number {
    if (/^\d+$/.test(s)) return Number(s)                             // SS
    let m = s.match(/^([0-5]?\d):([0-5]\d)$/)                         // MM:SS
    if (m) return (+m[1]) * 60 + (+m[2])
    m = s.match(/^(\d+):([0-5]\d):([0-5]\d)$/)                        // HH:MM:SS
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])
    fail('expected SS, MM:SS, or HH:MM:SS')
    return NaN
}

export function secsToHms(total: number): string {
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = Math.floor(total % 60)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function toEng(x: number, u: string, e?: number): string {
    if (x == 0) return `0 ${u}`
    const exp = e ?? Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}`, [3]: ` k${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(1).padStart(4, ' ')}${unit}`
}

export function uAmps(val: number): string {
    return toEng(val, 'A', -6)
}

export function uJoules(j: number): string {
    return toEng(j, 'J', -6)
}

export function version(): string {
    const path = Path.resolve(__dirname, '..', 'package.json')
    const jobj = JSON.parse(Fs.readFileSync(path, 'utf-8'))
    return jobj.version
}
