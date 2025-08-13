import * as Core from './Core'
import * as Jls from 'node_jls'
import * as Path from 'path'

export function saveSignal(cap: Core.Capture, cname: string, sig: Core.Signal, markers: Core.Marker[] = []) {
    const writer = WriterAux.create(cap, cname)
    writer.store(sig.data, sig.sample_rate)
    for (const m of markers) {
        writer.addMarker(m)
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
    addMarker(m: Core.Marker) {
        this.#jfile.markerAnnotation(1, m.offset, '1a')
        this.#jfile.markerAnnotation(1, m.offset + m.width, '1b')
    }
    finalize() {
        this.#jfile.close()
        Core.infoMsg(`wrote '${this.cname}.jls'`)
    }
    store(f32: Readonly<Core.F32>, sample_rate: number) {
        const sdef: Jls.SourceDef = {
            source_id: 1,
            name: 'mysource',
            vendor: 'emf',
            model: 'sim',
            version: '1.0',
            serial_number: '00000001',
        }
        this.#jfile.sourceDef(sdef)
        const sigdef: Jls.SignalDef = {
            signal_id: 1,
            source_id: 1,
            signal_type: 0,
            data_type: 8196,
            sample_rate: sample_rate,
            samples_per_data: f32.length,
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
        this.#jfile.writeF32(1, f32)
    }
}
