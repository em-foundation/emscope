import * as Core from './Core'

import AdmZip from 'adm-zip'
import Fs from 'fs'
import Path from 'path'

export async function exec(opts: any) {
    const rootdir = Path.resolve(opts.capture)
    const zip = new AdmZip()
    zip.addLocalFolder(Path.join(rootdir, '.emscope'))
    zip.writeZip(Path.join(rootdir, 'emscope-capture.zip'))
}
