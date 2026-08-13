import * as Core from './Core'

import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'


export function update(capdir: string) {
    const cap = Core.Capture.load(capdir)
    const ids = getDeclarationIds(cap)
    const act = readPedsDeclaration('activities', ids.activity)
    const plt = readPedsDeclaration('platforms', ids.platform)
    const pwr = readPedsDeclaration('power', ids.power)
    const subtitle = mkSubtitle(cap)
    const generated = new Date()
    const obj = mkJson(cap, act, plt, pwr, subtitle, generated)
    const md_file = Path.join(cap.rootdir, 'ABOUT.md')
    const json_file = Path.join(cap.rootdir, 'about.json')
    if (Fs.existsSync(md_file) && Fs.existsSync(json_file) && sameJson(json_file, obj)) return

    const out = `<!-- GENERATED FILE — DO NOT EDIT -->

<h1 align="center">${plt.title}</h1>
<h3 align="center">${subtitle}</h3>
${mkGen(cap, act, plt, pwr, generated)}
`
    Fs.writeFileSync(md_file, out)
    Fs.writeFileSync(json_file, `${JSON.stringify(obj, null, 4)}\n`)
}

interface ResolvedDeclaration {
    moniker: string
    url: string
    title: string
    factoids: string[]
    references: Reference[]
}

interface Reference {
    title: string
    url: string
}

interface Declaration {
    title: string
    inherits: string[]
    factoids: string[]
    references: Reference[]
}

interface VoltageStats {
    avg: number
    min: number
    max: number
    std: number
    droop: number
}

type DeclarationKind = 'activities' | 'platforms' | 'power'

interface DeclarationIds {
    activity: string
    platform: string
    power: string
}

const PEDS_ROOT = 'https://github.com/em-foundation/PEDS/blob/main'

function getDeclarationIds(cap: Core.Capture): DeclarationIds {
    let dir = cap.rootdir
    while (Path.basename(dir) != 'captures') {
        const parent = Path.dirname(dir)
        Core.fail(`capture is not below a 'captures' directory: ${cap.rootdir}`, parent == dir)
        dir = parent
    }

    const repo = Path.dirname(dir)
    const parts = Path.relative(dir, cap.rootdir).split(Path.sep).filter(Boolean)
    Core.fail(`unable to resolve platform moniker from capture path: ${cap.rootdir}`, parts.length < 2)

    return {
        activity: Path.basename(repo),
        platform: parts[0],
        power: parts.length > 2 ? parts[1] : 'bench',
    }
}

function readPedsDeclaration(kind: DeclarationKind, moniker: string): ResolvedDeclaration {
    const url = `${PEDS_ROOT}/${kind}/${moniker}.md`
    const top = readDeclaration(url)
    const factoids: string[] = []
    const references: Reference[] = []
    const visited = new Set<string>()
    const seen_refs = new Set<string>()

    explodeDeclaration(url, factoids, references, visited, seen_refs)

    return {
        moniker,
        url,
        title: top.title,
        factoids,
        references,
    }
}

function explodeDeclaration(
    url: string,
    factoids: string[],
    references: Reference[],
    visited: Set<string>,
    seen_refs: Set<string>,
) {
    const key = canonicalUrl(url)
    if (visited.has(key)) return
    visited.add(key)

    const decl = readDeclaration(url)

    for (const inh of decl.inherits) {
        explodeDeclaration(inh, factoids, references, visited, seen_refs)
    }

    factoids.push(...decl.factoids)

    for (const ref of decl.references) {
        const key = `${ref.title}\n${ref.url}`
        if (seen_refs.has(key)) continue
        seen_refs.add(key)
        references.push(ref)
    }
}

function readDeclaration(url: string): Declaration {
    const txt = readUrl(url)
    return parseDeclaration(url, txt)
}

function readUrl(url: string): string {
    const raw = githubRawUrl(url)
    const is_win = process.platform === 'win32'
    const cmd = is_win ? 'curl.exe' : 'curl'
    const args = is_win ? ['-fsSL', '--tlsv1.2', '--ssl-no-revoke', raw] : ['-fsSL', raw]
    try {
        return ChildProc.execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch (e: any) {
        Core.fail(`unable to read declaration: ${url}`)
        return ''
    }
}

function githubRawUrl(url: string): string {
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)
    if (!m) return url
    return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`
}

function canonicalUrl(url: string): string {
    try {
        const u = new URL(url)
        u.hash = ''
        return u.toString()
    } catch {
        return url
    }
}

function resolveUrl(base: string, ref: string): string {
    try {
        return new URL(ref, base).toString()
    } catch {
        Core.fail(`invalid declaration URL '${ref}' in ${base}`)
        return ''
    }
}

function parseDeclaration(url: string, txt: string): Declaration {
    const lines = txt.split(/\r?\n/)
    const title_line = lines.find(s => /^#\s+/.test(s.trim()))
    Core.fail(`declaration has no title: ${url}`, title_line === undefined)

    const title = title_line!.trim().replace(/^#\s+/, '')
    const inherits: string[] = []
    const factoids: string[] = []
    const references: Reference[] = []

    for (const raw of lines) {
        const line = raw.trim()
        if (!/^[-*]\s+/.test(line)) continue
        const body = line.replace(/^[-*]\s+/, '')

        const inh = body.match(/^INHERITS\s+\[([^\]]+)\]\(([^)]+)\)\s*$/)
        if (inh) {
            inherits.push(resolveUrl(url, inh[2]))
            continue
        }

        const links = [...body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
        for (const m of links) {
            references.push({
                title: m[1],
                url: resolveUrl(url, m[2]),
            })
        }

        if (/^\[[^\]]+\]\([^)]+\)\s*$/.test(body)) continue

        const plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        factoids.push(`- ${plain}`)
    }

    return {
        title,
        inherits,
        factoids,
        references,
    }
}

function getBuildDir(cap: Core.Capture): string {
    return Path.join(Path.dirname(cap.rootdir), 'build')
}

function getEvtFiles(cap: Core.Capture): string[] {
    return Fs.readdirSync(cap.rootdir).filter(fn => /^event\-[A-Z]\.png$/.test(fn)).sort()
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

function mkPlatformTxt(cap: Core.Capture, plt: ResolvedDeclaration): string {
    const refs = [...plt.references]
    if (Fs.existsSync(getBuildDir(cap))) {
        refs.push({
            title: 'BUILD ARTIFACTS',
            url: '../build',
        })
    }
    return mkDeclarationTxt(plt, refs)
}

function mkActivityTxt(act: ResolvedDeclaration): string {
    return `

## Activity

${mkDeclarationTxt(act, act.references)}
`
}

function mkPowerTxt(pwr: ResolvedDeclaration): string {
    return `

## Power Source

${mkDeclarationTxt(pwr, pwr.references)}
`
}

function mkDeclarationTxt(decl: ResolvedDeclaration, refs: Reference[]): string {
    const out: string[] = []
    out.push(...decl.factoids)
    if (refs.length) {
        out.push('', '### References', '')
        for (const ref of refs) {
            out.push(`- [${ref.title}](${ref.url})`)
        }
    }
    return out.join('\n')
}

function mkGen(cap: Core.Capture, act: ResolvedDeclaration, plt: ResolvedDeclaration, pwr: ResolvedDeclaration, generated: Date): string {
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const aobj = cap.analysis!
    const sl_v = cap.avg_voltage
    const vstats = getVoltageStats(cap)
    const sl_avg = aobj.sleep.avg
    const sl_std = aobj.sleep.std
    const sl_pwr = sl_v * sl_avg
    const egy1_e = averageEventEnergy(cap, aobj.events)
    const evt_dur = averageEventDuration(cap, aobj.events)
    Core.fail('1 s event period shorter than average event duration', 1 < evt_dur)
    const egy1_s = (sl_pwr * (1 - evt_dur)) + egy1_e
    const egy1_d = egy1_s * 86400
    const ems1 = 80 / egy1_d
    const egy10_s = (sl_pwr * (10 - evt_dur)) + egy1_e
    const egy10_d = egy10_s * 86400 / 10
    const ems10 = 80 / egy10_d
    const cap_date = mkTimestamp(cap.creation_date)
    const gen_date = mkTimestamp(generated)
    const plt_txt = mkPlatformTxt(cap, plt)
    const evt_files = getEvtFiles(cap)
    const evt_txt = evt_files.length ? `

## Typical Event

${evt_files.map(fn => `<p align="center"><img src="${fn}" alt="Event" width="900"></p>`).join('\n')}
` : ''
    const notes = readCaptureNotes(cap)
    const notes_txt = notes ? `

## Notes

${notes}
` : ''

    return `

<p align="right"><sub>captured on ${cap_date}<br>generated on ${gen_date}</sub></p>${mkActivityTxt(act)}

## Platform

${plt_txt}${mkPowerTxt(pwr)}


## EM&bull;Scope results · ${cap.device}
${mkVoltageTxt(vstats)}
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

function jsonDeclaration(decl: ResolvedDeclaration) {
    return {
        moniker: decl.moniker,
        url: decl.url,
        title: decl.title,
        factoids: decl.factoids.map(s => s.replace(/^-\s+/, '')),
        references: decl.references,
    }
}

function mkJson(
    cap: Core.Capture,
    act: ResolvedDeclaration,
    plt: ResolvedDeclaration,
    pwr: ResolvedDeclaration,
    subtitle: string,
    generated: Date,
) {
    Core.fail(`no prior analysis: run 'emscope scan ...'`, cap.analysis === undefined)
    const aobj = cap.analysis!
    const sl_v = cap.avg_voltage
    const vstats = getVoltageStats(cap)
    const sl_avg = aobj.sleep.avg
    const sl_std = aobj.sleep.std
    const sl_pwr = sl_v * sl_avg
    const egy1_e = averageEventEnergy(cap, aobj.events)
    const evt_dur = averageEventDuration(cap, aobj.events)
    Core.fail('1 s event period shorter than average event duration', 1 < evt_dur)
    const egy1_s = (sl_pwr * (1 - evt_dur)) + egy1_e
    const egy1_d = egy1_s * 86400
    const egy10_s = (sl_pwr * (10 - evt_dur)) + egy1_e
    const egy10_d = egy10_s * 86400 / 10
    const evt_files = getEvtFiles(cap)
    const bld_dir = getBuildDir(cap)
    return {
        id: `${act.moniker}:${plt.moniker}:${Path.basename(cap.rootdir)}`,
        schema_version: '1',
        generator: {
            name: 'EM•Scope',
            version: Core.version(),
        },
        units: {
            time: 's',
            current: 'A',
            voltage: 'V',
            power: 'W',
            energy: 'J',
        },
        activity: jsonDeclaration(act),
        platform: jsonDeclaration(plt),
        power: jsonDeclaration(pwr),
        capture: {
            name: Path.basename(cap.rootdir),
            subtitle,
            device: cap.device,
            created: cap.creation_date.toISOString(),
            generated: generated.toISOString(),
            duration: cap.duration,
            sampling_rate: cap.sampling_rate,
            sample_count: cap.sample_count,
            voltage: vstats ? {
                source: 'measured',
                ...vstats,
            } : {
                source: 'declared',
                value: sl_v,
            },
            images: evt_files,
            build_artifacts: Fs.existsSync(bld_dir) ? '../build' : undefined,
        },
        events: {
            count: aobj.events.length,
            duration_avg: evt_dur,
            energy_avg: egy1_e,
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
}

function sameJson(file: string, obj: any): boolean {
    try {
        const old_obj = JSON.parse(Fs.readFileSync(file, 'utf-8'))
        const new_obj = JSON.parse(JSON.stringify(obj))
        delete old_obj.capture?.generated
        delete new_obj.capture?.generated
        return JSON.stringify(old_obj) == JSON.stringify(new_obj)
    } catch {
        return false
    }
}

function getVoltageStats(cap: Core.Capture): VoltageStats | undefined {
    if (cap.voltage != -1) return undefined

    let count = 0
    let sum = 0
    let sum_sq = 0
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (const v of cap.voltage_sig.data) {
        if (!Number.isFinite(v) || v <= 0) continue
        count += 1
        sum += v
        sum_sq += v * v
        min = Math.min(min, v)
        max = Math.max(max, v)
    }

    Core.fail('no valid voltage samples found', count == 0)

    const avg = sum / count
    const variance = Math.max(0, (sum_sq / count) - (avg * avg))

    return {
        avg,
        min,
        max,
        std: Math.sqrt(variance),
        droop: avg - min,
    }
}

function mkVoltageTxt(stats: VoltageStats | undefined): string {
    if (!stats) return '\n'
    return `
### 🟠&ensp;measured voltage

| &emsp;average&emsp; | &emsp;minimum&emsp; | &emsp;maximum&emsp; | &emsp;standard deviation&emsp;
|:---:|:---:|:---:|:---:|
| ${stats.avg.toFixed(3)} V | ${stats.min.toFixed(3)} V | ${stats.max.toFixed(3)} V | ${stats.std.toFixed(3)} V |

`
}

function averageEventEnergy(cap: Core.Capture, markers: Core.Marker[]): number {
    Core.fail('no events found', markers.length == 0)
    let total = 0
    for (const m of markers) {
        total += cap.energyWithin(m)
    }
    return total / markers.length
}

function averageEventDuration(cap: Core.Capture, markers: Core.Marker[]): number {
    Core.fail('no events found', markers.length == 0)
    let total = 0
    for (const m of markers) {
        total += m.width / cap.sampling_rate
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
