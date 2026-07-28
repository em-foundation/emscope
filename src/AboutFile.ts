import * as Core from './Core'

import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'


export function update(capdir: string) {
    const cap = Core.Capture.load(capdir)
    const plt = readPlatform(cap)
    const title = plt.title
    const subtitle = mkSubtitle(cap)
    const out = `<!-- GENERATED FILE — DO NOT EDIT -->

<h1 align="center">${title}</h1>
<h3 align="center">${subtitle}</h3>
${mkGen(cap, plt)}
`
    Fs.writeFileSync(Path.join(cap.rootdir, 'ABOUT.md'), out)
    writeJson(cap, plt, subtitle)
}

interface Platform {
    url: string
    title: string
    factoids: string[]
    references: string[]
}

function readPlatform(cap: Core.Capture): Platform {
    const file = findPlatformFile(cap.rootdir)
    const lines = Fs.readFileSync(file, 'utf-8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    Core.fail(`invalid '.platform' file: expected one URL`, lines.length != 1)
    const url = lines[0]
    const txt = readUrl(url)
    return parsePlatform(url, txt)
}

function findPlatformFile(capdir: string): string {
    let dir = capdir
    while (true) {
        const file = Path.join(dir, '.platform')
        if (Fs.existsSync(file)) return file
        const parent = Path.dirname(dir)
        Core.fail(`no '.platform' file found`, parent == dir)
        dir = parent
    }
}

function readUrl(url: string): string {
    const raw = githubRawUrl(url)
    const is_win = process.platform === 'win32'
    const cmd = is_win ? 'curl.exe' : 'curl'
    const args = is_win ? ['-fsSL', '--tlsv1.2', '--ssl-no-revoke', raw] : ['-fsSL', raw]
    try {
        return ChildProc.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch (e: any) {
        Core.fail(`unable to read platform declaration: ${url}`)
        return ''
    }
}

function githubRawUrl(url: string): string {
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
    if (!m) return url
    return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`
}

function parsePlatform(url: string, txt: string): Platform {
    const lines = txt.split(/\r?\n/)
    const title_line = lines.find(s => /^#\s+/.test(s.trim()))
    Core.fail(`platform declaration has no title: ${url}`, title_line === undefined)
    const title = title_line!.trim().replace(/^#\s+/, '')
    const factoids: string[] = []
    const references: string[] = []
    const seen = new Set<string>()

    for (const raw of lines) {
        const line = raw.trim()
        if (!/^[-*]\s+/.test(line)) continue
        const body = line.replace(/^[-*]\s+/, '')
        Core.fail(`INHERITS is not supported yet: ${url}`, /^INHERITS\b/.test(body))

        const links = [...body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
        for (const m of links) {
            const ref = `- [${m[1]}](${m[2]})`
            if (!seen.has(ref)) {
                seen.add(ref)
                references.push(ref)
            }
        }

        if (/^\[[^\]]+\]\([^)]+\)\s*$/.test(body)) continue
        const plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        factoids.push(`- ${plain}`)
    }

    return { url, title, factoids, references }
}

function getBuildDir(cap: Core.Capture): string {
    return Path.join(Path.dirname(cap.rootdir), 'build')
}

function getEvtFile(cap: Core.Capture): string {
    for (const fn of Fs.readdirSync(cap.rootdir)) {
        if (/^event\-[A-Z]\.png$/.test(fn)) return fn
    }
    return ''
}

function readCaptureNotes(cap: Core.Capture): string {
    const file = Path.join(cap.rootdir, 'CAPTURE.md')
    if (!Fs.existsSync(file)) return ''
    return Fs.readFileSync(file, 'utf-8').trim()
}

function mkSubtitle(cap: Core.Capture): string {
    const name = Path.basename(cap.rootdir)

    const soc = name.match(/^soc-(\d+)-[JPO]$/i)
    if (soc) return `${soc[1]}% SOC`

    const volt = name.match(/^(\dV\d)-[JPO]$/i)
    if (volt) return `Bench supply · ${volt[1]}`

    return name.replace(/\-[JPO]$/i, '')
}

function mkPlatformTxt(cap: Core.Capture, plt: Platform): string {
    const out: string[] = []
    out.push(...plt.factoids)

    const refs = [...plt.references]
    if (Fs.existsSync(getBuildDir(cap))) {
        refs.push(`- [BUILD ARTIFACTS](../build) &thinsp;⚙️`)
    }

    if (refs.length) {
        out.push('', '### References', '', ...refs)
    }
    return out.join('\n')
}

function mkGen(cap: Core.Capture, plt: Platform): string {
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const aobj = cap.analysis!
    const sl_v = cap.avg_voltage
    const sl_avg = aobj.sleep.avg
    const sl_std = aobj.sleep.std
    const sl_pwr = sl_v * sl_avg
    const egy1_e = averageEventEnergy(cap, aobj.events)
    const egy1_s = sl_pwr + egy1_e
    const egy1_d = egy1_s * 86400
    const ems1 = 80 / egy1_d
    const egy10_s = (sl_pwr * 10) + egy1_e
    const egy10_d = egy10_s * 86400 / 10
    const ems10 = 80 / egy10_d
    const cap_date = mkTimestamp(cap.creation_date)
    const gen_date = mkTimestamp(new Date())
    const plt_txt = mkPlatformTxt(cap, plt)
    const evt_file = getEvtFile(cap)
    const evt_txt = evt_file ? `

## Typical Event

<p align="center"><img src="${evt_file}" alt="Event" width="900"></p>
` : ''
    const notes = readCaptureNotes(cap)
    const notes_txt = notes ? `

## Notes

${notes}
` : ''

    return `

<p align="right"><sub>captured on ${cap_date}<br>generated on ${gen_date}</sub></p>

## Platform

${plt_txt}


## EM&bull;Scope results · ${cap.device}

### 🟠&ensp;sleep

| supply voltage | &emsp;current (avg)&emsp; | &emsp;current (std)&emsp; | &emsp;average power&emsp;
|:---:|:---:|:---:|:---:|
| ${sl_v.toFixed(1)} V | ${Core.uAmps(sl_avg)} | ${Core.uAmps(sl_std)} | ${Core.toEng(sl_pwr, 'W')} |

### 🟠&ensp;1&thinsp;s event period

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per period&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.uJoules(egy1_e)} | ${Core.uJoules(egy1_s)} | ${Core.joules(egy1_d)} | ${ems1.toFixed(2)} |

### 🟠&ensp;10&thinsp;s event period

| &emsp;&emsp;event energy (avg)&emsp;&emsp; | &emsp;&emsp;energy per period&emsp;&emsp; | &emsp;&emsp;energy per day&emsp;&emsp; | &emsp;&emsp;&emsp;**EM&bull;eralds**&emsp;&emsp;&emsp;
|:---:|:---:|:---:|:---:|
| ${Core.uJoules(egy1_e)} | ${Core.uJoules(egy10_s)} | ${Core.joules(egy10_d)} | ${ems10.toFixed(2)} |${evt_txt}${notes_txt}`
}

function writeJson(cap: Core.Capture, plt: Platform, subtitle: string) {
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const aobj = cap.analysis!
    const sl_v = cap.avg_voltage
    const sl_avg = aobj.sleep.avg
    const sl_std = aobj.sleep.std
    const sl_pwr = sl_v * sl_avg
    const egy1_e = averageEventEnergy(cap, aobj.events)
    const egy1_s = sl_pwr + egy1_e
    const egy1_d = egy1_s * 86400
    const egy10_s = (sl_pwr * 10) + egy1_e
    const egy10_d = egy10_s * 86400 / 10
    const evt_file = getEvtFile(cap)
    const bld_dir = getBuildDir(cap)
    const obj = {
        platform: {
            url: plt.url,
            title: plt.title,
            factoids: plt.factoids.map(s => s.replace(/^-\s+/, '')),
            references: plt.references.map(s => {
                const m = s.match(/^- \[([^\]]+)\]\(([^)]+)\)$/)
                return m ? { title: m[1], url: m[2] } : { title: s, url: '' }
            }),
        },
        capture: {
            name: Path.basename(cap.rootdir),
            subtitle,
            device: cap.device,
            created: cap.creation_date.toISOString(),
            generated: new Date().toISOString(),
            avg_voltage: sl_v,
            event_image: evt_file || undefined,
            build_artifacts: Fs.existsSync(bld_dir) ? '../build' : undefined,
        },
        sleep: {
            current_avg: sl_avg,
            current_std: sl_std,
            power_avg: sl_pwr,
        },
        periods: {
            one_second: {
                event_energy: egy1_e,
                energy_per_period: egy1_s,
                energy_per_day: egy1_d,
                emeralds: 80 / egy1_d,
            },
            ten_seconds: {
                event_energy: egy1_e,
                energy_per_period: egy10_s,
                energy_per_day: egy10_d,
                emeralds: 80 / egy10_d,
            },
        },
    }
    const file = Path.join(cap.rootdir, 'about.json')
    Fs.writeFileSync(file, `${JSON.stringify(obj, null, 4)}\n`)
}

function averageEventEnergy(cap: Core.Capture, markers: Core.Marker[]): number {
    Core.fail('no events found', markers.length == 0)
    let total = 0
    for (const m of markers) {
        total += cap.energyWithin(m)
    }
    return total / markers.length
}

function mkTimestamp(d: Date): string {
    const ds = d.toISOString().split('T')[0]
    const pad = (n: number) => String(n).padStart(2, '0')
    const HH = pad(d.getUTCHours())
    const MM = pad(d.getUTCMinutes())
    const SS = pad(d.getUTCSeconds())
    return `${ds} @ ${HH}:${MM}:${SS}`
}
