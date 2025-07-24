#!/usr/bin/env node

import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'
import * as Dumper from './Dumper'
import * as Exporter from './Exporter'

import * as Commander from 'commander'

const CMD = new Commander.Command('emgauge')

CMD.command('js220')
    .description('capture using Jouleccope JS220')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .action((opts: any) => Driver_JS220.exec(opts))

CMD.command('ppk2')
    .description('capture using Nordic PPK2')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .option('-v --voltage <value>', 'source voltage', parseFloat, 3.3)
    .action((opts: any) => Driver_PPK2.exec(opts))

CMD.command('dump')
    .description('dump captured information')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .option('-e --event-number <value>', 'event number', parseFloat, 0)
    .action((opts: any) => Dumper.exec(opts))

CMD.command('export')
    .description('export a Joulescope JLS file')
    .option('-c --capture <dir>', 'working capture directory', '.')
    .action((opts: any) => Exporter.exec(opts))

try {
    CMD.parse(process.argv)
} catch (err) {
    console.log(err)
    process.exit(1)
}