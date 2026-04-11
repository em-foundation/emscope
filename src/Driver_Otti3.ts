import * as Core from './Core'
import Fs from 'fs'
import Net from 'net'
import Path from 'path'

export async function execCapture(opts: any): Promise<Core.Capture> {

    const jobj = Core.findConfig()
    Core.fail("can't find 'emscope-local.json'", jobj === undefined)
    const config = jobj.otii3 as OtiiConfig

    const cap = Core.Capture.create(opts.capture, opts.duration, 'Otii3')
    const progress = new Core.Progress('capturing: ')

    const otii = new OtiiSession('127.0.0.1', 1905)
    await otii.connect()

    if (!await otii.isLoggedIn()) {
        await otii.login(config.username, config.password)
    }

    for (const license of await otii.getLicenses()) {
        await otii.reserveLicense(license.id)
    }

    const dev = await otii.requireDevice()
    const projectId = await otii.getOrCreateProject()
    await otii.addToProject(dev.device_id)
    await otii.setMainVoltage(dev.device_id, opts.voltage)
    await otii.setMaxCurrent(dev.device_id, 0.5)
    await otii.enableChannel(dev.device_id, 'mc', true)
    await otii.enableChannel(dev.device_id, 'mv', true)

    const bp = opts.batteryProfile
    Core.fail("missing battery profile index", bp !== undefined && typeof (bp) != 'number')
    if (bp) {
        await batteryConfig(otii, bp as number, dev.device_id, config)
    } else {
        await otii.setSupplyPowerBox(dev.device_id)
    }

    await otii.setMain(dev.device_id, true)
    await progress.spin(2500)
    await record(otii, cap, progress, projectId, dev.device_id)
    await otii.setSupplyPowerBox(dev.device_id)
    await otii.close()
    return cap
}

async function batteryConfig(otii: OtiiSession, bidx: number, deviceId: string, config: OtiiConfig): Promise<void> {
    const bname = config.batteries[bidx]
    Core.fail("invalid battery index", typeof (bname) != 'string')
    const profiles = await otii.getBatteryProfiles()
    let bprof = profiles.find(p => p.name === bname)
    Core.fail("no corresponding profile found", bprof === undefined)
    await otii.setSupplyBatteryEmulator(deviceId, {
        batteryProfileId: bprof!.battery_profile_id,
        soc: 2
    })
}

async function record(
    otii: OtiiSession,
    cap: Core.Capture,
    progress: Core.Progress,
    projectId: number,
    deviceId: string
): Promise<void> {
    const t0 = Date.now()
    const t1 = t0 + cap.duration * 1000

    await otii.startRecording(projectId)

    try {
        while (true) {
            const now = Date.now()
            if (now >= t1) {
                break
            }

            progress.update(`${((now - t0) / 1000).toFixed(3)} s`)
            await new Promise(resolve => setTimeout(resolve, 100))
        }
    } finally {
        await otii.setMain(deviceId, false)
        await otii.stopRecording(projectId)
    }

    const recordingId = await otii.getLastRecording(projectId)
    const current = await otii.getAllChannelData(recordingId, deviceId, 'mc')
    for (const sample of current.values) {
        cap.current_ds.add(sample)
    }
    const voltage = await otii.getAllChannelData(recordingId, deviceId, 'mv')
    for (const sample of voltage.values) {
        cap.voltage_ds.add(sample)
    }

    await otii.deleteRecording(recordingId)

    progress.clear()
}

type OtiiConfig = {
    username: string
    password: string
    batteries: string[]
}

type OtiiMsg = {
    type: string
    cmd?: string
    trans_id?: string
    info?: string
    message?: string
    data?: any
    errorcode?: string
}

type OtiiDeviceInfo = {
    device_id: string
    name: string
    type: string
}

type OtiiChannelData = {
    interval: number
    values: number[]
}

type OtiiBatteryInfo = {
    battery_profile_id: string,
    name: string,
    manufacturer: string,
    model: string
}

type OttiLicenseInfo = {
    id: number,
    type: string,
    reserved_to: string,
    hostname: string,
    available: boolean,
}

class OtiiSession {
    private readonly socket = new Net.Socket()
    private rx = ''
    private nextId = 1
    private ready = false

    private readonly pending = new Map<
        string,
        {
            resolve: (msg: OtiiMsg) => void
            reject: (err: Error) => void
            timer: NodeJS.Timeout
        }
    >()

    constructor(
        readonly host = '127.0.0.1',
        readonly port = 1905,
        private readonly debug = false
    ) {
        this.socket.on('data', chunk => this.onData(chunk))
        this.socket.on('error', err => this.onError(err))
        this.socket.on('close', () => this.onClose())
    }

    async connect(timeoutMs = 5000): Promise<void> {
        if (this.ready) {
            return
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup()
                reject(new Error('timeout waiting for connect banner'))
            }, timeoutMs)

            const onError = (err: Error) => {
                cleanup()
                reject(err)
            }

            const cleanup = () => {
                clearTimeout(timer)
                this.socket.off('error', onError)
                    ; (this as any)._onBanner = undefined
            }

            this.socket.on('error', onError)
                ; (this as any)._onBanner = () => {
                    cleanup()
                    resolve()
                }

            this.socket.connect(this.port, this.host, () => {
                this.log(`socket connected to ${this.host}:${this.port}`)
            })
        })
    }

    async close(): Promise<void> {
        if (this.socket.destroyed) {
            return
        }

        await new Promise<void>(resolve => {
            this.socket.once('close', () => resolve())
            this.socket.end()
        })
    }

    async getDevices(timeoutSec = 5): Promise<OtiiDeviceInfo[]> {
        const data = await this.cmd('otii_get_devices', { timeout: timeoutSec }, (timeoutSec + 3) * 1000)
        return data?.devices ?? []
    }

    async requireDevice(deviceId?: string): Promise<OtiiDeviceInfo> {
        const devices = await this.getDevices()

        if (deviceId) {
            const dev = devices.find(d => d.device_id === deviceId)
            if (!dev) {
                throw new Error(`device not found: ${deviceId}`)
            }
            return dev
        }

        if (devices.length === 0) {
            throw new Error('no devices found')
        }

        return devices[0]
    }

    async getOrCreateProject(): Promise<number> {
        const active = await this.cmd('otii_get_active_project')
        const projectId = active?.project_id

        if (projectId != null && projectId !== -1) {
            return projectId
        }

        const created = await this.cmd('otii_create_project')
        if (created?.project_id == null) {
            throw new Error('failed to create project')
        }

        return created.project_id
    }

    async addToProject(deviceId: string): Promise<void> {
        await this.cmd('arc_add_to_project', { device_id: deviceId }, 10000)
    }

    async setMainVoltage(deviceId: string, value: number): Promise<void> {
        await this.cmd('arc_set_main_voltage', { device_id: deviceId, value })
    }

    async setMaxCurrent(deviceId: string, value: number): Promise<void> {
        await this.cmd('arc_set_max_current', { device_id: deviceId, value })
    }

    async enableChannel(deviceId: string, channel: string, enable: boolean): Promise<void> {
        await this.cmd('arc_enable_channel', { device_id: deviceId, channel, enable })
    }

    async setMain(deviceId: string, value: boolean): Promise<void> {
        await this.cmd('arc_set_main', { device_id: deviceId, enable: value })
    }

    async startRecording(projectId: number): Promise<void> {
        await this.cmd('project_start_recording', { project_id: projectId }, 10000)
    }

    async stopRecording(projectId: number): Promise<void> {
        await this.cmd('project_stop_recording', { project_id: projectId }, 10000)
    }

    async getLastRecording(projectId: number): Promise<number> {
        const data = await this.cmd('project_get_last_recording', { project_id: projectId }, 10000)
        const recordingId = data?.recording_id

        if (recordingId == null || recordingId === -1) {
            throw new Error('no recording found')
        }

        return recordingId
    }

    async deleteRecording(recordingId: number): Promise<void> {
        await this.cmd('recording_delete', {
            recording_id: recordingId
        })
    }

    async getChannelDataCount(
        recordingId: number,
        deviceId: string,
        channel: string
    ): Promise<number> {
        const data = await this.cmd('recording_get_channel_data_count', {
            recording_id: recordingId,
            device_id: deviceId,
            channel
        }, 15000)

        return data.count
    }

    async getChannelData(
        recordingId: number,
        deviceId: string,
        channel: string,
        index: number,
        count: number
    ): Promise<OtiiChannelData> {
        const data = await this.cmd('recording_get_channel_data', {
            recording_id: recordingId,
            device_id: deviceId,
            channel,
            index,
            count
        }, 30000)

        return {
            interval: data.interval,
            values: data.values ?? []
        }
    }

    async getAllChannelData(
        recordingId: number,
        deviceId: string,
        channel: string
    ): Promise<OtiiChannelData> {
        const total = await this.getChannelDataCount(recordingId, deviceId, channel)

        let index = 0
        let remaining = total
        const chunkSize = 100000
        let interval = 0
        const values: number[] = []

        while (remaining > 0) {
            const count = Math.min(remaining, chunkSize)

            const data = await this.cmd('recording_get_channel_data', {
                recording_id: recordingId,
                device_id: deviceId,
                channel,
                index,
                count
            }, 30000)

            if (index === 0) {
                interval = data.interval
            }

            values.push(...(data.values ?? []))

            index += count
            remaining -= count
        }

        return { interval, values }
    }

    async getBatteryProfiles(): Promise<OtiiBatteryInfo[]> {
        const data = await this.cmd('otii_get_battery_profiles')
        return data?.battery_profiles ?? []
    }

    async setSupplyBatteryEmulator(
        deviceId: string,
        opts: {
            batteryProfileId: string
            series?: number
            parallel?: number
            soc?: number
            usedCapacity?: number
            socTracking?: boolean
        }
    ): Promise<void> {
        await this.cmd('arc_set_supply_battery_emulator', {
            device_id: deviceId,
            battery_profile_id: opts.batteryProfileId,
            ...(opts.series !== undefined ? { series: opts.series } : {}),
            ...(opts.parallel !== undefined ? { parallel: opts.parallel } : {}),
            ...(opts.soc !== undefined ? { soc: opts.soc } : {}),
            ...(opts.usedCapacity !== undefined ? { used_capacity: opts.usedCapacity } : {}),
            ...(opts.socTracking !== undefined ? { soc_tracking: opts.socTracking } : {})
        }, 10000)
    }

    async setSupplyPowerBox(deviceId: string): Promise<void> {
        await this.cmd('arc_set_supply_power_box', {
            device_id: deviceId
        }, 10000)
    }

    async isLoggedIn(): Promise<boolean> {
        const data = await this.cmd('otii_is_logged_in')
        return data.logged_in
    }

    async login(username: string, password: string): Promise<void> {
        await this.cmd('otii_login', { username, password }, 10000)
    }

    async getLicenses(): Promise<OttiLicenseInfo[]> {
        const data = await this.cmd('otii_get_licenses')
        return data?.licenses ?? []
    }

    async hasLicense(licenseType: 'Automation' | 'Battery'): Promise<boolean> {
        const data = await this.cmd('otii_has_license', { license_type: licenseType })
        return data.has_license
    }

    async reserveLicense(licenseId: number): Promise<void> {
        await this.cmd('otii_reserve_license', { license_id: licenseId }, 10000)
    }

    async returnLicense(licenseId: number): Promise<void> {
        await this.cmd('otii_return_license', { license_id: licenseId }, 10000)
    }

    async logout(): Promise<void> {
        await this.cmd('otii_logout', undefined, 10000)
    }

    private async cmd(cmd: string, data?: any, timeoutMs = 3000): Promise<any> {
        const rsp = await this.request(cmd, data, timeoutMs)
        return rsp.data
    }

    private async request(cmd: string, data?: any, timeoutMs = 3000): Promise<OtiiMsg> {
        if (!this.ready) {
            throw new Error('not connected')
        }

        const transId = String(this.nextId++)
        const req: OtiiMsg = {
            type: 'request',
            cmd,
            trans_id: transId
        }

        if (data !== undefined) {
            req.data = data
        }

        return await new Promise<OtiiMsg>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(transId)
                reject(new Error(`timeout waiting for ${cmd}`))
            }, timeoutMs)

            this.pending.set(transId, { resolve, reject, timer })

            this.logObj('send', req)
            this.socket.write(JSON.stringify(req) + '\r\n')
        })
    }

    private onData(chunk: Buffer) {
        this.rx += chunk.toString('utf8')

        for (; ;) {
            const idx = this.rx.indexOf('\r\n')
            if (idx < 0) {
                break
            }

            const line = this.rx.slice(0, idx).trim()
            this.rx = this.rx.slice(idx + 2)

            if (!line) {
                continue
            }

            const msg = JSON.parse(line) as OtiiMsg
            this.logObj('recv', msg)

            if (
                msg.type === 'information' &&
                (msg.info === 'connected' || msg.message === 'connected')
            ) {
                this.ready = true
                const onBanner = (this as any)._onBanner as (() => void) | undefined
                onBanner?.()
                continue
            }

            if (!msg.trans_id) {
                continue
            }

            const p = this.pending.get(msg.trans_id)
            if (!p) {
                continue
            }

            clearTimeout(p.timer)
            this.pending.delete(msg.trans_id)

            if (msg.type === 'error') {
                p.reject(new Error(msg.errorcode ?? `server error for ${msg.cmd}`))
            } else {
                p.resolve(msg)
            }
        }
    }

    private onError(err: Error) {
        for (const [, p] of this.pending) {
            clearTimeout(p.timer)
            p.reject(err)
        }
        this.pending.clear()
    }

    private onClose() {
        const err = new Error('socket closed')

        for (const [, p] of this.pending) {
            clearTimeout(p.timer)
            p.reject(err)
        }
        this.pending.clear()
    }

    private log(msg: string) {
        if (this.debug) {
            console.log(msg)
        }
    }

    private logObj(prefix: string, obj: unknown) {
        if (this.debug) {
            console.log(`${prefix}:`, obj)
        }
    }
}
