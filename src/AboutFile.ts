import * as Core from './Core'
import * as Detecter from './Detecter'

import * as Fs from 'fs'
import * as Path from 'path'

const TAG = '@emscope-pack'
const START = `<!-- ${TAG}:start -->`
const END = `<!-- ${TAG}:end -->`
const RE = /<!--\s*@emscope-pack:start\s*-->[\s\S]*?<!--\s*@emscope-pack:end\s*-->/m


export function update(capdir: string) {
    const cap = Core.Capture.load(capdir)
    const TXT = `
<h1 align="center">Hardware Platform · Software Environment</h1>

## HW/SW configuration

## EM&bull;Scope results

${START}

${END}

## Typical event

<p align="center">
    <img src="${cap.basename}-event-ID.png" alt="Event" width="900">
</p>

## Observations

`
    const file = Path.join(cap.rootdir, 'ABOUT.md')
    if (!Fs.existsSync(file)) {
        Fs.writeFileSync(file, TXT)
    }
    const src = Fs.readFileSync(file, 'utf-8')
    const gen = mkGen(cap)
    const block = `${START}\n\n${gen}\n\n${END}`
    const out = RE.test(src) ? src.replace(RE, block) : `${src.replace(/\s*$/, '')}\n\n${block}\n`
    Fs.writeFileSync(file, out)
}

export function mkGen(cap: Core.Capture): string {
    const aobj = cap.analysis ?? Detecter.analyze(cap)
    const si = aobj.sleep
    const sl_v = cap.avg_voltage
    const sl_avg = aobj.sleep.avg
    const sl_std = aobj.sleep.std
    const sl_pwr = sl_v * sl_avg
    const egy1_s = cap.energyWithin(aobj.span) / cap.current_sig.offToSecs(aobj.span.width)
    const egy1_e = egy1_s - cap.avg_voltage * si.avg
    const egy1_d = egy1_s * 86400
    const ems1 = 80 / egy1_d
    const egy10_s = (sl_pwr * 10) + egy1_e
    const egy10_d = egy10_s * 86400 / 10
    const ems10 = 80 / egy10_d



    // | 30.980&thinsp;&mu;J | 32.971&thinsp;&mu;J | 2.844&thinsp;J | 28.13 |


    const date = new Date().toISOString();
    const GEN = `
### 🟠&ensp;sleep

| supply voltage | &emsp;current (avg)&emsp; | &emsp;current (std)&emsp; | &emsp;average power&emsp;
|:---:|:---:|:---:|:---:|
| ${sl_v.toFixed(2)} V | ${Core.amps(sl_avg)} | ${Core.amps(sl_std)} | ${Core.toEng(sl_pwr, 'W')} |

### 🟠&ensp;1&thinsp;s event cycle

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per cycle&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.joules(egy1_e)} | ${Core.joules(egy1_s)} | ${Core.joules(egy1_d)} | ${ems1.toFixed(2)} |

### 🟠&ensp;10&thinsp;s event cycle

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per cycle&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.joules(egy1_e)} | ${Core.joules(egy10_s)} | ${Core.joules(egy10_d)} | ${ems10.toFixed(2)} |

<br>
<p align="right"><sub>generated at ${date}</sub></p>
    `
    return GEN
}