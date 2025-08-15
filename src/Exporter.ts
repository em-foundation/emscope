import * as Core from './Core'

import AdmZip from 'adm-zip'
import ChildProc from 'child_process'
import Fs from 'fs'
import Path from 'path'

export async function exec(opts: any) {
    const capdir = Path.resolve(opts.capture)
    if (opts.unpack) {
        deflate(capdir)
    } else {
        const zip = new AdmZip()
        zip.addLocalFolder(Path.join(capdir, '.emscope'), '.emscope')
        zip.writeZip(Path.join(capdir, 'emscope-capture.zip'))
    }
}

function deflate(capdir: string) {
    let repo = ''
    let dir = capdir
    while (dir !== Path.parse(dir).root) {
        if (Fs.existsSync(Path.join(dir, '.git'))) {
            repo = dir
            break
        }
        dir = Path.dirname(dir)
    }
    Core.fail('capture directory not contained within a git repo', repo.length == 0)
    const prefix = Path.relative(repo, capdir).replaceAll('\\', '/')
    for (const fn of Fs.readdirSync(capdir)) {
        const fpath = Path.join(capdir, fn)
        if (fn == 'emscope-capture.zip' && isLfsDesc(fpath)) {
            deflateLfs(fpath, repo, prefix)
        }
    }
}

const LFS_MAGIC = 'version https://git-lfs.github.com/spec'
const HEAD_BYTES = 512

function deflateLfs(path: string, repo: string, prefix: string) {
    ChildProc.execFileSync('git', ['lfs', 'pull', '--include', prefix], { cwd: repo, stdio: 'inherit' })
    ChildProc.execFileSync('git', ['lfs', 'checkout', prefix], { cwd: repo, stdio: 'inherit' })
}

function isLfsDesc(path: string): boolean {
    const fd = Fs.openSync(path, 'r')
    const buf = Buffer.alloc(HEAD_BYTES)
    const n = Fs.readSync(fd, buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, n).toString('utf-8').startsWith(LFS_MAGIC)
}