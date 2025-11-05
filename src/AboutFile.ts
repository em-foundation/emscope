import * as Core from './Core'
import * as Detecter from './Detecter'

import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'

const TAG = '@emscope-pack'
const START = `<!-- ${TAG}:start -->`
const END = `<!-- ${TAG}:end -->`
const RE = /<!--\s*@emscope-pack:start\s*-->[\s\S]*?<!--\s*@emscope-pack:end\s*-->/m


export function update(capdir: string) {
    const cap = Core.Capture.load(capdir)
    const TXT = `<h1 align="center">Hardware Platform · Software Environment · xVx</h1>

${START}
${END}
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

function getBuildDir(cap: Core.Capture): string {
    const bn = Path.basename(cap.rootdir).split('-')[0]
    return Path.join(Path.dirname(cap.rootdir), bn)
}

function getEvtId(cap: Core.Capture): string {
    for (const fn of Fs.readdirSync(cap.rootdir)) {
        const m = fn.match(/^event\-([A-Z])\.png$/)
        if (m) return m[1]
    }
    Core.fail(`no 'event-ID.png' file found`)
    return ''
}

function mkGen(cap: Core.Capture): string {
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const brd = Path.basename(Path.dirname(cap.rootdir))
    const brd_txt = readBrdTxt(brd)
    const bld_dir = getBuildDir(cap)
    const bld_txt = readBldTxt(bld_dir)
    const eid = getEvtId(cap)
    const aobj = cap.analysis!
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
    const date = new Date().toISOString();
    const GEN = `
## HW/SW Configuration

${brd_txt}
* [BOARD PINOUT](https://github.com/em-foundation/emscope/blob/docs-stable/docs/boards/${brd}.png) &thinsp;⚙️
${bld_txt}
* [BUILD ARTIFACTS](../${Path.basename(bld_dir)}) &thinsp;⚙️


## EM&bull;Scope results · JS220

### 🟠&ensp;sleep

| supply voltage | &emsp;current (avg)&emsp; | &emsp;current (std)&emsp; | &emsp;average power&emsp;
|:---:|:---:|:---:|:---:|
| ${sl_v.toFixed(1)} V | ${Core.amps(sl_avg)} | ${Core.amps(sl_std)} | ${Core.toEng(sl_pwr, 'W')} |

### 🟠&ensp;1&thinsp;s event period

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per period&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.joules(egy1_e)} | ${Core.joules(egy1_s)} | ${Core.joules(egy1_d)} | ${ems1.toFixed(2)} |

### 🟠&ensp;10&thinsp;s event period

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per period&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.joules(egy1_e)} | ${Core.joules(egy10_s)} | ${Core.joules(egy10_d)} | ${ems10.toFixed(2)} |

<br>
<p align="right"><sub>generated at ${date}</sub></p>

## Typical Event

<p align="center"><img src="event-${eid}.png" alt="Event" width="900"></p>

## Notes
`
    return GEN
}

function readBldTxt(bld_dir: string): string {
    try {
        return Fs.readFileSync(Path.join(bld_dir, 'BUILD.md'), { encoding: 'utf-8' })
    } catch (e: any) {
        console.log(e)
        Core.fail(`can't read 'BUILD.md'`)
    }
    return ''
}

function readBrdTxt(brd: string): string {
    const url = `https://raw.githubusercontent.com/em-foundation/emscope/docs-stable/docs/boards/${brd}.md`
    const is_win = process.platform === 'win32'
    const cmd = is_win ? 'curl.exe' : 'cur'
    const args = is_win ? ['-fsSL', '--tlsv1.2', '--ssl-no-revoke', url] : ['-fsSL', url]
    try {
        return ChildProc.execFileSync(cmd, args, { encoding: 'utf8' })
    } catch (e: any) {
        const msg = e?.stderr?.toString() || e?.stdout?.toString() || e?.message || String(e)
        Core.fail(msg)
    }
    return ''
}
