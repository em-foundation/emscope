import Fs from 'fs'
import Path from 'path'

export class SampleSet {
    private data: Float32Array<ArrayBuffer>
    private idx = 0
    constructor(readonly size: number) {
        this.data = new Float32Array(size)
    }
    get is_full(): boolean { return this.idx >= this.size }
    get length(): number { return this.idx }
    add(value: number) {
        if (!this.is_full) {
            this.data[this.idx++] = value
        }
    }
    save(dir: string, name: string) {
        Fs.writeFileSync(Path.join(dir, `${name}.f32.bin`), this.data)
    }
}


export function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}
