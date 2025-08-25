import * as Core from './Core'

import * as Fs from 'fs'
import * as Path from 'path'
import * as Pico from 'picomatch'

export type CmdFxn = (opts: any) => void

type CmdDesc = { fxn: CmdFxn, opts: any }

export function execCmd(fxn: CmdFxn, opts: any, popts: any) {
    const glob_opt = popts.captureGlob
    if (glob_opt === undefined) {
        fxn(opts)
        return
    }
    const glob = (glob_opt === true) ? '*' : (glob_opt as string)
    visit(process.cwd(), glob, { fxn: fxn, opts: opts })

}

function visit(dir: string, glob: string, cmd: CmdDesc) {
    for (const de of Fs.readdirSync(dir, { withFileTypes: true })) {
        if (!de.isDirectory()) continue
        const dpath = Path.join(de.parentPath, de.name)
        if (Fs.existsSync(Path.join(dpath, 'capture.yaml')) && Pico.isMatch(de.name, glob)) {
            console.log(`\n${de.name}:`)
            cmd.fxn({ ...cmd.opts, capture: dpath })
        } else {
            visit(Path.join(dpath), glob, cmd)
        }
    }
}