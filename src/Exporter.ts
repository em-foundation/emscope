import * as Core from './Core'
import * as Jls from 'node_jls'

export function exec(cap: Core.Capture) {
    const jfile = new Jls.Writer('capture.jls')
    const sdef: Jls.SourceDef = {
        source_id: 1,
        name: 'mysource',
        vendor: 'emf',
        model: 'sim',
        version: '1.0',
        serial_number: '00000001',
    }
    jfile.sourceDef(sdef)
    const f32 = cap.current_ds.data
    const sigdef: Jls.SignalDef = {
        signal_id: 1,
        source_id: 1,
        signal_type: 0,
        data_type: 8196,
        sample_rate: cap.sampling_rate,
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
    jfile.signalDef(sigdef)
    jfile.writeF32(1, f32)
    jfile.close()
}