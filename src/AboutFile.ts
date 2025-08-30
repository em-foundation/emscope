import * as Core from './Core'

import * as Fs from 'fs'
import * as Path from 'path'

const TAG = '@emscope-pack'
const START = `<!-- ${TAG}:start -->`
const END = `<!-- ${TAG}:end -->`
const RE = /<!--\s*@emscope-pack:start\s*-->[\s\S]*?<!--\s*@emscope-pack:end\s*-->/m

const TXT = `
<h1 align="center">Hardware Platform · Software Environment</h1>

## HW/SW configuration

## EM&bull;Scope results

${START}

${END}

## Typical event

## Observations

`



export function update(capdir: string) {
    const cap = Core.Capture.load(capdir)
    const afile = Path.join(cap.rootdir, 'ABOUT.md')
    if (!Fs.existsSync(afile)) {
        Fs.writeFileSync(afile, TXT)
    }
    const src = Fs.readFileSync(afile, 'utf-8')
    const gen = 'generated results'
    const block = `${START}\n\n${gen}\n\n${END}`
    const out = RE.test(src) ? src.replace(RE, block) : `${src.replace(/\s*$/, '')}\n\n${block}\n`
    Fs.writeFileSync(afile, out)
 
 
    // const [head] = src.split(/^---\s*$/m)
    // const gen = new Date().toISOString()
    // const atxt = `${head.replace(/\s*$/, '')}\n---\n${gen}\n`
}