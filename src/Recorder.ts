import * as Analyzer from './Analyzer'
import * as Core from './Core'
import * as Driver_JS220 from './Driver_JS220'
import * as Driver_PPK2 from './Driver_PPK2'

export async function exec(opts: any) {
    console.log(opts)
    if (!opts.js220 && !opts.ppk2) {
        console.log('*** you must specify an analyzer device')
        process.exit(1)
    }
}