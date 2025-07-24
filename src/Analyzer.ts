import * as Core from './Core'

export function exec(cap: Core.Capture) {
    const events = findEvents(cap)
    const window: Core.Marker = {
        sample_offset: events[0].sample_offset - (cap.sampling_rate / 2),
        sample_count: events.length * cap.sampling_rate
    }
    const egy_per_sec = cap.markerEnergy(window) / events.length
    const aobj = {
        window: window,
        events: {
            markers: events,
            avg_duration: Core.toEng(Core.avg(events.map(e => e.sample_count)) / cap.sampling_rate, 's'),
            avg_current: Core.toEng(Core.avg(events.map(e => cap.markerCurrent(e))), 'A'),
            avg_energy: Core.toEng(Core.avg(events.map(e => cap.markerEnergy(e))), 'J'),
        },
        energy_per_sec: Core.toEng(egy_per_sec, 'J'),
        energy_per_day: Core.toEng(egy_per_sec * 86400, 'J'),
        energy_per_year: Core.toEng(egy_per_sec * 86400 * 365, 'J'),
        efficiency_score: `${(2400 / (egy_per_sec * 86400 * 365)).toFixed(3)} EM•eralds`
    }
    cap.bind(aobj)
    console.log(`  ==> ${aobj.efficiency_score}`)
}

function findEvents(cap: Core.Capture): Core.Marker[] {
    const thresh = 0.0001
    const dt = 0.001
    const min_width = Math.round(dt * cap.sampling_rate)
    let res = new Array<Core.Marker>()
    let in_event = false
    let sample_offset = 0
    const data = Array.from(cap.current_ds.data)
    const kalman = new Core.KalmanFilter(1e-6, 1e-6, 1e-5, 1e-2)
    for (const [i, sample] of cap.current_ds.data.entries()) {
        const val = kalman.update(sample)
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
                    sample_offset: sample_offset,
                    sample_count: width,
                })
            }
            in_event = false
        }
    }
    return res
}
