import * as Core from './Core'

import AdmZip from 'adm-zip'
import Fs from 'fs'
import Path from 'path'

export async function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const cdir = Path.resolve(opts.capture)
    const odir = opts.output as string
    const zip = new AdmZip()
    addToZip(zip, cdir, 'emscope.yaml')
    addToZip(zip, cdir, 'current.f32.bin')
    // if (cap.device == 'JS220') {
    //     zip.addLocalFile('voltage.f32.bin')
    // }
    const zfile = Path.join(odir, `${Path.basename(cdir)}.zip`)
    zip.writeZip(zfile)
}

function addToZip(zip: AdmZip, cdir: string, name: string) {
    const path = Path.join(cdir, name)
    zip.addFile(Path.join(Path.basename(cdir), name), Fs.readFileSync(path))
}