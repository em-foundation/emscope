import * as Analyzer from './Analyzer'
import * as Core from './Core'

import { SerialPort } from 'serialport'

enum Cmd {
    NO_OP = 0x00,
    TRIGGER_SET = 0x01,
    AVG_NUM_SET = 0x02,  // no-firmware
    TRIGGER_WINDOW_SET = 0x03,
    TRIGGER_INTERVAL_SET = 0x04,
    TRIGGER_SINGLE_SET = 0x05,
    AVERAGE_START = 0x06,
    AVERAGE_STOP = 0x07,
    RANGE_SET = 0x08,
    LCD_SET = 0x09,
    TRIGGER_STOP = 0x0a,
    DEVICE_RUNNING_SET = 0x0c,
    REGULATOR_SET = 0x0d,
    SWITCH_POINT_DOWN = 0x0e,
    SWITCH_POINT_UP = 0x0f,
    TRIGGER_EXT_TOGGLE = 0x11,
    SET_POWER_MODE = 0x11,
    RES_USER_SET = 0x12,
    SPIKE_FILTERING_ON = 0x15,
    SPIKE_FILTERING_OFF = 0x16,
    GET_META_DATA = 0x19,
    RESET = 0x20,
    SET_USER_GAINS = 0x25,
}

type Mode = 'ampere' | 'source'

interface Mask {
    pos: number
    mask: number
}
const mode_cmd_map = new Map<Mode, Cmd>([
    ['ampere', Cmd.TRIGGER_SET],
    ['source', Cmd.AVG_NUM_SET],
])

const generateMask = (bits: number, pos: number): Mask => ({
    pos,
    mask: (2 ** bits - 1) << pos,
})
const MEAS_ADC = generateMask(14, 0)
const MEAS_RANGE = generateMask(3, 14)
const MEAS_COUNTER = generateMask(6, 18)
const MEAS_LOGIC = generateMask(8, 24)

const MAX_PAYLOAD_COUNTER = 0b111111 // 0x3f, 64 - 1
const DATALOSS_THRESHOLD = 500 // 500 * 10us = 5ms: allowed loss

interface Modifiers {
    r: modifier
    gs: modifier
    gi: modifier
    o: modifier
    s: modifier
    i: modifier
    ug: modifier
}
type modifier = [number, number, number, number, number]
type modifiers = {
    [Property in keyof Modifiers]: modifier
}

const getMaskedValue = (value: number, { mask, pos }: Mask): number =>
    (value & mask) >> pos

export async function exec(opts: any) {
    const path_list = await findDevices()
    if (path_list.length == 0) {
        console.error("*** no PPK2 analyzer")
        process.exit(1)
    }
    const progress = new Core.Progress('capturing: ')
    const port = new SerialPort({ path: path_list[0], baudRate: 115200, autoOpen: false })
    await new Promise<void>((resolve, reject) => {
        port.open(err => (err ? reject(err) : resolve()))
    })
    await progress.spin(500)
    port.on('data', () => { })
    const cap = Core.Capture.create(opts.capture, opts.duration, 'PPK2', opts.voltage)
    const ppk = new PPK2(port, cap)
    await ppk.getModifiers()
    ppk.setSourceVoltage(cap.voltage * 1000)
    ppk.setMode('source')
    ppk.togglePower('on')
    await ppk.capture(progress)
    ppk.togglePower('off')
    ppk.close()
    Analyzer.exec(cap)
    cap.save()
}

async function findDevices(): Promise<Array<string>> {
    let res = new Array<string>()
    for (const port of await SerialPort.list()) {
        const name: string = (port as any).friendlyName
        if (name.startsWith('nRF Connect')) {
            res.push(port.path)
        }
    }
    return res
}

function parseMods(mods: string) {
    mods = mods
        .replace('END', '')
        .trim()
        .toLowerCase()
        .replace(/-nan/g, 'null')
        .replace(/\n/g, ',\n"')
        .replace(/: /g, '": ')
    let res
    try {
        res = JSON.parse(`{"${mods}}`)
    } catch (err: any) {
        console.log(err.message)
        process.exit(1)
    }
    return res
}

class PPK2 {

    #cap: Core.Capture
    #port: SerialPort

    #modifiers: modifiers = {
        r: [1031.64, 101.65, 10.15, 0.94, 0.043],
        gs: [1, 1, 1, 1, 1],
        gi: [1, 1, 1, 1, 1],
        o: [0, 0, 0, 0, 0],
        s: [0, 0, 0, 0, 0],
        i: [0, 0, 0, 0, 0],
        ug: [1, 1, 1, 1, 1],
    }

    #adcMult = 1.8 / 163840

    #spikeFilter = {
        alpha: 0.18,
        alpha5: 0.06,
        samples: 3,
    }

    #expectedCounter: null | number = null
    #dataLossCounter: number = 0
    #corruptedSamples: { value: number; bits: number }[] = []
    #rollingAvg: undefined | number
    #rollingAvg4: undefined | number
    #prevRange: undefined | number
    #afterSpike: undefined | number
    #consecutiveRangeSample: undefined | number

    #currentVdd = 0

    constructor(port: SerialPort, cap: Core.Capture) {
        this.#cap = cap
        this.#port = port
    }

    async capture(progress: Core.Progress): Promise<void> {
        await progress.spin(2000)
        this.startMeasurement()
        return await new Promise<void>(resolve => {
            const raw = Buffer.allocUnsafe(this.#cap.duration * 100_000 * 4)
            let offset = 0
            this.#port.on('data', buf => {
                progress.update(`${(offset / 100_000 / 4).toFixed(3)} s`)
                const len = Math.min(buf.length, raw.length - offset)
                buf.copy(raw, offset, 0, len)
                offset += len
                if (offset >= raw.length) {
                    progress.done()
                    this.#port.on('data', () => { })
                    this.stopMeasurement()
                    for (const adcVal of new Uint32Array(raw.buffer, raw.byteOffset, raw.length / 4)) {
                        this.#cap.current_ds.add(this.#handleRawDataSet(adcVal) / 1_000_000)
                    }
                    resolve()
                }
            })
        })
    }

    close() {
        if (this.#port.isOpen) {
            this.#write([Cmd.RESET])
            this.#port.close()
        }
    }

    async getModifiers(): Promise<any> {
        this.#write([Cmd.GET_META_DATA])
        return new Promise(resolve => {
            let res = ''
            const onData = (data: Buffer) => {
                res += data.toString()
                if (res.includes('END')) {
                    this.#port.off('data', onData)
                    const meta = this.#parseMeta(parseMods(res))
                    resolve(meta)
                }
            }
            this.#port.on('data', onData)
        })
    }

    setMode(mode: Mode) {
        this.#write([Cmd.SET_POWER_MODE, mode_cmd_map.get(mode)!])
    }

    setSourceVoltage(vdd: number) {
        this.#currentVdd = vdd
        this.#write([Cmd.REGULATOR_SET, vdd >> 8, vdd & 0xff])
    }

    startMeasurement() {
        this.#rollingAvg = undefined
        this.#rollingAvg4 = undefined
        this.#prevRange = undefined
        this.#consecutiveRangeSample = 0
        this.#afterSpike = 0
        this.#write([Cmd.AVERAGE_START])
    }

    stopMeasurement() {
        this.#write([Cmd.AVERAGE_STOP])
    }

    togglePower(state: 'on' | 'off') {
        this.#write([Cmd.DEVICE_RUNNING_SET, state == 'on' ? 1 : 0])
    }

    #dataLossReport(missingSamples: number) {
        if (
            this.#dataLossCounter < DATALOSS_THRESHOLD &&
            this.#dataLossCounter + missingSamples >= DATALOSS_THRESHOLD
        ) {
            console.error(
                'Data loss detected. See https://github.com/Nordicsemiconductor/pc-nrfconnect-ppk/blob/main/doc/docs/troubleshooting.md#data-loss-with-ppk2'
            )
        }
        this.#dataLossCounter += missingSamples
    }

    #getAdcResult(range: number, adcVal: number): number {
        const resultWithoutGain =
            (adcVal - this.#modifiers.o[range]) *
            (this.#adcMult / this.#modifiers.r[range])

        let adc =
            this.#modifiers.ug[range] *
            (resultWithoutGain *
                (this.#modifiers.gs[range] * resultWithoutGain +
                    this.#modifiers.gi[range]) +
                (this.#modifiers.s[range] * (this.#currentVdd / 1000) +
                    this.#modifiers.i[range]))

        const prevRollingAvg4 = this.#rollingAvg4
        const prevRollingAvg = this.#rollingAvg

        this.#rollingAvg =
            this.#rollingAvg === undefined
                ? adc
                : this.#spikeFilter.alpha * adc +
                (1.0 - this.#spikeFilter.alpha) * this.#rollingAvg
        this.#rollingAvg4 =
            this.#rollingAvg4 === undefined
                ? adc
                : this.#spikeFilter.alpha5 * adc +
                (1.0 - this.#spikeFilter.alpha5) * this.#rollingAvg4

        if (this.#prevRange === undefined) {
            this.#prevRange = range
        }

        if (this.#prevRange !== range || this.#afterSpike! > 0) {
            if (this.#prevRange !== range) {
                // number of measurements after the spike which still to be averaged
                this.#consecutiveRangeSample = 0
                this.#afterSpike = this.#spikeFilter.samples
            } else {
                this.#consecutiveRangeSample! += 1
            }
            // Use previous rolling average if within first two samples of range 4
            if (range === 4) {
                if (this.#consecutiveRangeSample! < 2) {
                    this.#rollingAvg4 = prevRollingAvg4
                    this.#rollingAvg = prevRollingAvg
                }
                adc = this.#rollingAvg4!
            } else {
                adc = this.#rollingAvg
            }
            // adc = range === 4 ? this.rollingAvg4 : this.rollingAvg
            this.#afterSpike! -= 1
        }
        this.#prevRange = range
        return adc
    }

    #handleRawDataSet(adcValue: number): number {
        if (adcValue == 0) console.log('*** zero')
        let res = NaN
        try {
            const currentMeasurementRange = Math.min(
                getMaskedValue(adcValue, MEAS_RANGE),
                this.#modifiers.r.length
            )
            const counter = getMaskedValue(adcValue, MEAS_COUNTER)
            const adcResult = getMaskedValue(adcValue, MEAS_ADC) * 4
            const bits = getMaskedValue(adcValue, MEAS_LOGIC)
            const value = this.#getAdcResult(currentMeasurementRange, adcResult) * 1e6

            if (this.#expectedCounter === null) {
                this.#expectedCounter = counter
            } else if (
                this.#corruptedSamples.length > 0 &&
                counter === this.#expectedCounter
            ) {
                console.log(`*** corrupted samples: ${this.#corruptedSamples.length}`)
                // while (this.corruptedSamples.length > 0) {
                //     /// this.onSampleCallback(this.corruptedSamples.shift()!)
                // }
                this.#corruptedSamples = []
            } else if (this.#corruptedSamples.length > 4) {
                const missingSamples =
                    (counter - this.#expectedCounter + MAX_PAYLOAD_COUNTER) &
                    MAX_PAYLOAD_COUNTER
                this.#dataLossReport(missingSamples)
                for (let i = 0; i < missingSamples; i += 1) {
                    /// this.onSampleCallback({})
                }
                this.#expectedCounter = counter
                this.#corruptedSamples = []
            } else if (this.#expectedCounter !== counter) {
                this.#corruptedSamples.push({ value, bits })
            }

            this.#expectedCounter += 1
            this.#expectedCounter &= MAX_PAYLOAD_COUNTER
            res = value
            // Only fire the event, if the buffer data is valid
            /// this.onSampleCallback({ value, bits })
        } catch (err: unknown) {
            // TODO: This does not consistently handle all possibilites
            // Even though we expect all err to be instance of Error we should
            // probably also include an else and potentially log it to ensure all
            // branches are considered.
            if (err instanceof Error) {
                console.log(err.stack, 'original value', adcValue)
                process.exit(1)
            }
            // to keep timestamp consistent, undefined must be emitted
            /// this.onSampleCallback({})
        }
        return res
    }

    #parseMeta(meta: any) {
        // console.log(meta)
        Object.entries(this.#modifiers).forEach(
            ([modifierKey, modifierArray]) => {
                Array.from(modifierArray).forEach((modifier, index) => {
                    modifierArray[index] =
                        meta[`${modifierKey}${index}`] || modifier;
                });
            }
        );
        return meta;
    }

    #write(cmd: number[]) {
        // console.log('*** cmd', cmd)
        this.#port.write(cmd)
    }
}
