import * as Core from './Core'

import AdmZip from 'adm-zip'

export async function exec(opts: any) {
    const cap = Core.Capture.load(opts.capture)
    const zip = new AdmZip()
    zip.addLocalFile('emscope.yaml')
    zip.addLocalFile('current.f32.bin')
    // if (cap.device == 'JS220') {
    //     zip.addLocalFile('voltage.f32.bin')
    // }
    zip.writeZip('capture.zip')
}