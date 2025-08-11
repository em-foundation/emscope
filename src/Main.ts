#!/usr/bin/env node

import * as Dumper from './Algs'
import * as Exporter from './Exporter'
import * as Packer from './Packer'
import * as Plotter from './Plotter'
import * as Recorder from './Recorder'

import * as Commander from 'commander'

const CAP = ['-c --capture <directory path>', 'working capture directory', '.']

const CMD = new Commander.Command('emscope')

CMD.command('record')
    .description('capture information using an analyzer device')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-e --event-count <value>', 'number of 1Hz active events', parseFloat, 1)
    .option('-J --js220', 'use a Joulescope JS220 device')
    .option('-P --ppk2', 'use a Nordic PPK2 device')
    .addOption(new Commander.Option('-V, --voltage <value>', 'source voltage').argParser(parseFloat).default(3.3).conflicts('js220'))
    .addOption(new Commander.Option('-A --ampere-mode', 'enable PPK ampere mode').conflicts(['sourceMode', 'js220']))
    .addOption(new Commander.Option('-S --source-mode', 'enable PPK source mode').default(true).conflicts(['ampereMode', 'js220']))
    .action((opts: any) => Recorder.exec(opts))

// CMD.command('apply')
//     .description('apply algorithms to captured information')
//     .option('-c --capture <dir>', 'working capture directory', '.')
//     .option(
//         '-a, --algorithm-numbers <value...>',
//         'list of algorithm numbers',
//         (val: string, prev: number[] = []) => [...prev, Number(val)]
//     )
//     .action((opts: any) => Dumper.exec(opts))

// CMD.command('export')
//     .description('export captured information into a Joulescope .jls file')
//     .option('-c --capture <dir>', 'working capture directory', '.')
//     .action((opts: any) => Exporter.exec(opts))

CMD.command('export')
    .description('pack captured information into a .zip file')
    .option(CAP[0], CAP[1], CAP[2])
    .option('-o --output <dir>', 'output directory', '.')
    .action((opts: any) => Packer.exec(opts))

CMD.command('render')
    .description('show captured information in different formats')
    .option(CAP[0], CAP[1], CAP[2])
    .addOption(new Commander.Option('-j --jls-file', 'generate a Joulescope .jls file containing all events').conflicts(['htmlPlot', 'whatIf']))
    .addOption(new Commander.Option('-p --html-plot <event number>', 'generate a Plotly graph of a designated event').argParser(parseFloat).default(0).conflicts(['htmlPlot', 'jlsFile']))
    .addOption(new Commander.Option('-w --what-if <seconds per event>', 'extrapolate results at a different event rate').argParser(parseFloat).default(1).conflicts(['htmlPlot', 'jlsFile']))
    .action((opts: any) => Plotter.exec(opts))

try {
    CMD.parse(process.argv)
} catch (err) {
    console.log(err)
    process.exit(1)
}