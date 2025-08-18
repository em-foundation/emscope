import * as Core from './Core'

import AdmZip from 'adm-zip'
import ChildProc from 'child_process'
import Fs from 'fs'
import Path from 'path'

export async function exec(opts: any) {
    const capdir = Path.resolve(opts.capture)
    if (opts.lfsStatus || opts.lfsRestore || opts.unpack) {
        toggleLfs(capdir, opts)
    } else {
        const zip = new AdmZip()
        zip.addLocalFolder(Path.join(capdir, '.emscope'), '.emscope')
        zip.writeZip(Path.join(capdir, 'emscope-capture.zip'))
    }
}

const LFS_MAGIC = 'version https://git-lfs.github.com/spec'
const HEAD_BYTES = 512

function deflateLfs(repo: string, gpath: string) {
    ChildProc.execFileSync('git', ['lfs', 'pull', '--include', gpath], { cwd: repo, stdio: 'inherit' })
    ChildProc.execFileSync('git', ['lfs', 'checkout', gpath], { cwd: repo, stdio: 'inherit' })
}

function findRepoDir(capdir: string): string {
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
    return repo
}

function isLfsDesc(path: string): boolean {
    const fd = Fs.openSync(path, 'r')
    const buf = Buffer.alloc(HEAD_BYTES)
    const n = Fs.readSync(fd, buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, n).toString('utf-8').startsWith(LFS_MAGIC)
}

function restoreLfs(repo: string, gpath: string) {
    ChildProc.execFileSync('git', ['rm', '--cached', gpath], { cwd: repo, stdio: 'inherit' })
    ChildProc.execFileSync('git', ['checkout', 'HEAD', '--', gpath], { cwd: repo, stdio: 'inherit' })
}

function toggleLfs(capdir: string, opts: any) {
    const repo = findRepoDir(capdir)
    const zpath = Path.join(capdir, 'emscope-capture.zip')
    Core.fail(`no 'emscope-capture.zip' file found in the capture directory`, !Fs.existsSync(zpath))
    const prefix = Path.relative(repo, capdir).replaceAll('\\', '/')
    const gpath = `${prefix}/emscope-capture.zip`
    const desc_flag = isLfsDesc(zpath)
    if (opts.lfsStatus) {
        const stat_msg = desc_flag ? 'is an LFS descriptor' : 'is locally deflated'
        Core.infoMsg(`'emscope-capture.zip' ${stat_msg}`)
        return
    }
    if (opts.lfsRestore) {
        restoreLfs(repo, gpath)
        Fs.rmSync(Core.Capture.workdir(capdir), { recursive: true })
        return
    }
    // opts.unpack == true
    if (desc_flag) {
        deflateLfs(repo, gpath)
    }
    const zip = new AdmZip(zpath)
    zip.extractAllTo(capdir, true)
    Core.infoMsg('captured data now available locally')
}