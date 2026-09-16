import * as Core from './Core'

import * as Fs from 'fs'
import * as Path from 'path'
import * as Pico from 'picomatch'

export type CmdFxn = (opts: any) => void | Promise<void>

type CmdDesc = { fxn: CmdFxn, opts: any }

export async function execCmd(fxn: CmdFxn, opts: any, popts: any) {
    const glob_opt = popts.captureGlob
    if (glob_opt === undefined) {
        await fxn(opts)
        return
    }
    const glob = (glob_opt === true) ? '**' : (glob_opt as string)
    Core.setFailHook(msg => { throw new Core.FailError(msg) })
    try {
        await visit('.', glob, { fxn: fxn, opts: opts })
    } finally {
        Core.setFailHook()
    }
}

async function visit(dir: string, glob: string, cmd: CmdDesc) {
    for (const de of Fs.readdirSync(dir, { withFileTypes: true })) {
        if (!de.isDirectory()) continue
        const dpath = Path.join(de.parentPath, de.name).replaceAll('\\', '/')
        if (Fs.existsSync(Path.join(dpath, 'capture.yaml')) && Pico.isMatch(dpath, glob, { contains: true })) {
            console.log(`\n${dpath}:`)
            try {
                await cmd.fxn({ ...cmd.opts, capture: dpath })
            } catch (err) {
                if (!(err instanceof Core.FailError)) throw err
                process.exitCode = 1
            }
        } else {
            await visit(Path.join(dpath), glob, cmd)
        }
    }
}
