#!/usr/bin/env node

import * as Detecter from './Detecter'
import * as Exporter from './Exporter'
import * as Recorder from './Recorder'
import * as Renderer from './Renderer'

import * as Commander from 'commander'

const CAP = ['-c --capture <directory path>', 'working capture directory', '.']

const CMD = new Commander.Command('emscope')

CMD.command('grab')
    .description('record power signals with an attached capture device')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .option('-J --js220', 'use a Joulescope JS220 device')
    .option('-P --ppk2', 'use a Nordic PPK2 device')
    .addOption(new Commander.Option('-V, --voltage [value]', 'source voltage').argParser(parseFloat).default(3.3).conflicts('js220'))
    .addOption(new Commander.Option('-A --ampere-mode', 'enable PPK ampere mode').conflicts(['sourceMode', 'js220']))
    .addOption(new Commander.Option('-S --source-mode', 'enable PPK source mode').default(true).conflicts(['ampereMode', 'js220']))
    .action((opts: any) => Recorder.exec(opts))

CMD.command('scan')
    .description('analyze captured data and locate active events')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-t --trim', 'remove extra events')
    .action((opts: any) => Detecter.exec(opts))

CMD.command('view')
    .description('present captured data in different formats')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-e --event-info', 'characterize power consumption when active')
    .option('-j --jls-file', 'generate a Joulescope .jls file containing all events')
    .option('-p --html-plot <event number>', 'generate a Plotly graph of a designated event', parseFloat)
    .option('-s --sleep-info', 'characterize power consumption when inactive')
    .option('-w --what-if [seconds per event]', 'extrapolate results at a given event rate', parseFloat, 1)
    .action((opts: any) => Renderer.exec(opts))

CMD.command('pack')
    .description('bundle captured data into a .zip file')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-o --output <dir>', 'output directory', '.')
    .action((opts: any) => Exporter.exec(opts))

try {
    CMD.parse(process.argv)
} catch (err) {
    console.log(err)
    process.exit(1)
}