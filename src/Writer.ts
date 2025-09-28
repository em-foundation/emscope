import * as Core from './Core'
import * as Jls from 'jls-writer'
import * as Path from 'path'

export function saveSignal(cap: Core.Capture, cname: string, span: Core.Marker, markers: Core.Marker[] = []) {
    const is_single = markers.length == 1
    const writer = WriterAux.create(cap, cname)
    const msig_I = cap.current_sig.window(span.width, span.offset).toSignal()
    const msig_V = cap.voltage_sig.window(span.width, span.offset).toSignal()
    const data_V = msig_V.data.length > 0 ? msig_V.data : new Float32Array(msig_I.data.length).fill(cap.avg_voltage)
    writer.store(msig_I.data, data_V, msig_I.sample_rate, Math.trunc(cap.creation_date.getTime() / 1000))
    let cobj: any = {
        id: 'joulescope.ui.waveform_widget',
        version: '1.0',
        plots: {
            p: {
                enabled: true,
                range_mode: 'manual',
                range: [-0.002, 0.030],
            },
            i: {
                enabled: false,
            },
            v: {
                enabled: false,
            },
        },
        settings: [
            ['show_min_max', 'off'],
            ['show_statistics', false],
        ],
        actions: []
    }
    if (is_single) {
        cobj.settings.push(['control_location', 'off'])
        cobj.settings.push(['show_summary', false])
        cobj.actions.push(['!save_image', `${cname}.png`])
    }
    writer.addConfig(cobj)

    for (const m of markers) {
        const m2: Core.Marker = { offset: m.offset - span.offset, width: m.width, }
        writer.addMarker(m2)
    }
    writer.finalize()
}

class WriterAux {
    #jfile: Jls.Writer
    static create(cap: Core.Capture, cname: string): WriterAux {
        return new WriterAux(cap, cname)
    }
    private constructor(readonly cap: Core.Capture, readonly cname: string) {
        this.#jfile = new Jls.Writer(Path.join(this.cap.rootdir, `${cname}.jls`))
    }
    addConfig(cobj: any) {
        this.#jfile.userData(0x400, JSON.stringify(cobj))
    }
    addMarker(m: Core.Marker) {
        this.#jfile.markerAnnotation(1, m.offset, '1a')
        this.#jfile.markerAnnotation(1, m.offset + m.width, '1b')
    }
    finalize() {
        this.#jfile.close()
        Core.infoMsg(`wrote '${this.cname}.jls'`)
    }
    store(f32_I: Readonly<Core.F32>, f32_V: Readonly<Core.F32>, sample_rate: number, utc: number) {
        utc = Date.now() / 1000
        const sdef: Jls.SourceDef = {
            source_id: 1,
            name: 'mysource',
            vendor: 'emf',
            model: 'sim',
            version: '1.0',
            serial_number: '00000001',
        }
        this.#jfile.sourceDef(sdef)
        //
        let sigdef: Jls.SignalDef = {
            signal_id: 1,
            source_id: 1,
            signal_type: 0,
            data_type: 8196,
            sample_rate: sample_rate,
            samples_per_data: f32_I.length,
            sample_decimate_factor: 1,
            entries_per_summary: 1,
            summary_decimate_factor: 1,
            annotation_decimate_factor: 100,
            utc_decimate_factor: 100,
            sample_id_offset: BigInt(0),
            name: 'current',
            units: 'A',
        }
        this.#jfile.signalDef(sigdef)
        this.#jfile.writeF32(1, f32_I)
        this.#jfile.setTime(1, utc)
        //
        sigdef.signal_id = 2
        sigdef.name = 'voltage'
        sigdef.units = 'V'
        this.#jfile.signalDef(sigdef)
        this.#jfile.writeF32(2, f32_V)
        this.#jfile.setTime(2, utc)
        //
        const f32_W = new Float32Array(f32_I.length)
        for (let i = 0; i < f32_W.length; i++) {
            f32_W[i] = f32_I[i] * f32_V[i]
        }
        sigdef.signal_id = 3
        sigdef.name = 'power'
        sigdef.units = 'W'
        this.#jfile.signalDef(sigdef)
        this.#jfile.writeF32(3, f32_W)
        this.#jfile.setTime(3, utc)
    }
}
