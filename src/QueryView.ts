import * as Core from './Core'

import Fs from 'fs'
import Path from 'path'

export function exec(opts: any) {
    const capdir = Path.resolve(opts.capture)
    const apath = Path.join(capdir, 'analysis.yaml')
    const jpath = Path.join(capdir, 'about.json')

    Core.fail(`'analysis.yaml' is missing`, !Fs.existsSync(apath))
    Core.fail(`'about.json' is missing`, !Fs.existsSync(jpath))

    const a_mtime = Fs.statSync(apath).mtimeMs
    const j_mtime = Fs.statSync(jpath).mtimeMs
    const stale = j_mtime < a_mtime
    Core.infoMsg(`'about.json' is ${stale ? 'stale' : 'current'}`)

    const props = queryProperties(opts.query)
    if (props.length == 0) return

    const jobj = JSON.parse(Fs.readFileSync(jpath, 'utf-8'))
    for (const prop of props) {
        const val = queryProperty(jobj, prop)
        Core.fail(`property '${prop}' not found in 'about.json'`, val === undefined)
        Core.infoMsg(`${prop} = ${formatValue(val)}`)
    }
}

function queryProperties(opt: any): string[] {
    if (opt === true || opt === undefined) return []
    return Array.isArray(opt) ? opt : [opt]
}

function queryProperty(obj: any, prop: string): any {
    let val = obj
    for (const key of prop.split('.')) {
        if (val === null || typeof val != 'object' || !(key in val)) return undefined
        val = val[key]
    }
    return val
}

function formatValue(val: any): string {
    return typeof val == 'string' ? val : JSON.stringify(val)
}
