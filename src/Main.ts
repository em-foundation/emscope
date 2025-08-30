#!/usr/bin/env node

import * as Core from './Core'

import * as CmdApply from './CmdApply'
import * as Detecter from './Detecter'
import * as Exporter from './Exporter'
import * as Recorder from './Recorder'
import * as Renderer from './Renderer'

import * as Commander from 'commander'

const CAP = ['-c --capture <directory path>', 'working capture directory', '.']

const VERS = Core.version()

const CMD = new Commander.Command('emscope')
    .option('-C, --capture-glob [name pattern]', `apply this command to each matching child capture directory (default "*")`)
    .version(VERS)

CMD.command('grab')
    .description('record power signals with an attached capture device')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .option('-J --js220', 'use a Joulescope JS220 device')
    .option('-P --ppk2', 'use a Nordic PPK2 device')
    .addOption(new Commander.Option('-V, --voltage [value]', 'source voltage').argParser(parseFloat).default(3.3).conflicts('js220'))
    .addOption(new Commander.Option('-A --ampere-mode', 'enable PPK ampere mode').conflicts(['sourceMode', 'js220']))
    .addOption(new Commander.Option('-S --source-mode', 'enable PPK source mode').default(true).conflicts(['ampereMode', 'js220']))
    .action((opts: any, cmd: Commander.Command) => CmdApply.execCmd(Recorder.exec, opts, cmd.parent!.opts()))

CMD.command('scan')
    .description('analyze captured data and locate active events')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-g, --gap <milliseconds>', 'combine adjacent events whose gap is under a threshold', parseFloat)
    .option('-t --trim', 'remove extra events')
    .action((opts: any, cmd: Commander.Command) => CmdApply.execCmd(Detecter.exec, opts, cmd.parent!.opts()))

CMD.command('view')
    .description('present captured data in different formats')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-e --event-info', 'characterize power consumption when active')
    .option('-j --jls-file [event ID]', 'generate a Joulescope .jls file containing events')
    .option('-s --sleep-info', 'characterize power consumption when inactive')
    .option('-w --what-if [event-cycle rate]', `extrapolate results at a given event rate (default: '00:00:01')`, Core.parseHms)
    .option('--score', 'only print the EM•eralds benchmark score')
    .action((opts: any, cmd: Commander.Command) => CmdApply.execCmd(Renderer.exec, opts, cmd.parent!.opts()))

CMD.command('pack')
    .description(`bundle captured data into an 'emscope.zip' file`)
    .option(CAP[0], CAP[1], CAP[2])
    .option('-a --about-file', `update the 'ABOUT.md' file only`)
    .option('-u --unpack', `deflate an 'emscope.zip' file for local use`)
    .option('--lfs-status', `git status of the 'emscope.zip' file (debug only)`)
    .option('--lfs-restore', `restores the 'emscope.zip' LFS descriptor (debug only)`)
    .action((opts: any, cmd: Commander.Command) => CmdApply.execCmd(Exporter.exec, opts, cmd.parent!.opts()))

try {
    CMD.parse(process.argv)
} catch (err) {
    console.log(err)
    process.exit(1)
}

