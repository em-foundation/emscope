#!/usr/bin/env node

import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'
import * as Dumper from './Dumper'
import * as Exporter from './Exporter'
import * as Packer from './Packer'
import * as Plotter from './Plotter'
import * as Recorder from './Recorder'

import * as Commander from 'commander'

const CMD = new Commander.Command('emscope')

CMD.command('dump')
    .description('dump capture information')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-a --algorithm-number <value>', 'algorithm number', parseFloat, 0)
    .action((opts: any) => Dumper.exec(opts))

CMD.command('pack')
    .description('pack capture information')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .action((opts: any) => Packer.exec(opts))

CMD.command('plot')
    .description('plot a specified event')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-e --event-number <value>', 'event number', parseFloat, 0)
    .action((opts: any) => Plotter.exec(opts))

CMD.command('record')
    .alias('rec')
    .description('record information using an analyzer device')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .option('-J --js220', 'use a Joulescope JS220 device')
    .option('-P --ppk2', 'use a Nordic PPK2 device')
    .addOption(new Commander.Option('-V, --voltage <value>', 'source voltage').argParser(parseFloat).default(3.3).conflicts('js220'))
    .addOption(new Commander.Option('-A --ampere-mode', 'enable PPK ampere mode').conflicts(['sourceMode', 'js220']))
    .addOption(new Commander.Option('-S --source-mode', 'enable PPK source mode').default(true).conflicts(['ampereMode', 'js220']))
    .action((opts: any) => Recorder.exec(opts))

CMD.addHelpText('afterAll', `
Common Options:
  -c, --capture        working capture directory (default: ".")
`)

try {
    CMD.parse(process.argv)
} catch (err) {
    console.log(err)
    process.exit(1)
}