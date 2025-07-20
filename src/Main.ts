#!/usr/bin/env node

import * as Commander from 'commander'

const CMD = new Commander.Command('em-flux')
    .option('-c --capture <dir>', 'working capture directory', '.')

CMD.command('js220')
    .description('capture using Jouleccope JS220')
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)

CMD.command('ppk2')
    .description('capture using Nordic PPK2')
    .option('-d --duration <value>', 'capture duration in seconds', parseFloat, 3)
    .option('-v --voltage <value>', 'source voltage', parseFloat, 3.3)
CMD.command('display')
    .description('display capture information')
    .option('-e --event-number <value>', 'event number', parseFloat, 0)
// 

CMD.parse(process.argv)