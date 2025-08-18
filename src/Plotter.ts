import * as Core from './Core'

import Fs from 'fs'

const PRE = 300
const TOP = 1.05
const FONT_SIZE = 13

export function generate(samples: Core.SampleSet, event: Core.Marker) {
    const vals = samples.data.subarray(event.offset - PRE, event.offset + 5100)
    const html = genHtml(vals, event.width, 2)
    Fs.writeFileSync('event.html', html)
}

function genHtml(vals: Float32Array, width: number, down_sample: number = 1): string {
    const x_data = Core.decimate(down_sample, Array.from({ length: vals.length }, (_, i) => (i - PRE) * 0.001))
    const y_data = Core.decimate(down_sample, Array.from(vals).map(y => y * 1000))
    const html = `
<!DOCTYPE html>
<meta charset="utf-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inconsolata&display=swap');
  body {
    background: hsla(232,15%,15%,1);
    display: flex;
    justify-content:center;
    align-items:center;
    height:100vh
  }
  #plot-container {
    width: 680px;
    height: 400px;
    background: black;
    margin: auto;
    padding-top: 0px;
  }
</style>
<script src="https://cdn.plot.ly/plotly-2.30.1.min.js"></script>
<body>
<div id="plot-container">
  <div id="plot" style="width:100%; height:100%"></div>
</div>
<script>
Plotly.newPlot('plot', [{
    x: ${JSON.stringify(x_data)},
    y: ${JSON.stringify(y_data)},
    mode: 'lines',
    type: 'scatter',
    line: {
        color: 'yellow',
        width: 1,
    }
}], {
    paper_bgcolor: '#111',
    plot_bgcolor: '#111',
    font: { family: 'Inconsolata', color: '#eee' },
    margin: { l: 50, r: 20, t: 16, b: 30 },
    dragmode: 'zoom',
    modeBarButtonsToRemove: ['zoom2d'],
    xaxis: {
        side: 'bottom',
        color: '#eee',
        tickmode: 'array',
        tickvals: [0, 1, 2, 3, 4, 5],
        ticktext: ['0', '1', '2', '3', '4', '5'],
        tickfont: { size: ${FONT_SIZE}},
        showgrid: true,
        gridcolor: '#444',
        gridwidth: 2,
        minor: {
            tickmode: 'linear',
            tick0: 0,
            dtick: 0.25,
            showgrid: true,
            gridcolor: '#333',
            gridwidth: 1
        }
    },
    yaxis: {
        color: '#eee',
        range: [-0.5, 10.5],
        dtick: 2,
        fixedrange: true,
        gridcolor: '#444',
        gridwidth: 2,
        tickfont: { size: ${FONT_SIZE}},
        zeroline: true,
        zerolinecolor: '#444',
        zerolinewidth: 1,
        minor: {
            tickmode: 'linear',
            tick0: 0,
            dtick: 1,
            showgrid: true,
            gridcolor: '#333',
            gridwidth: 1
        }
    },
    shapes: [
        {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: 0,
            x1: ${width / 1000},
            y0: -0.1,
            y1: ${TOP},
            fillcolor: 'hsla(150, 100%, 50%, 0.10)',
            line: { width: 1, color: 'green' }
        },
        {
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: 0,
            x1: ${width / 1000},
            y0: 1,
            y1: ${TOP},
            fillcolor: 'hsla(150, 100%, 50%, 0.50)',
            line: { width: 1, color: 'green' }
        }
    ],
    annotations: [
        {
            xref: 'paper',
            yref: 'paper',
            x: -0.07,
            y: -0.05,
            text: 'ms',
            showarrow: false,
            font: { color: 'yellow', size: ${FONT_SIZE} },
            align: 'center'
        },
        {
            xref: 'paper',
            yref: 'paper',
            x: -0.07,
            y: 0.5,
            text: 'mA',
            showarrow: false,
            font: { color: 'yellow', size: ${FONT_SIZE} },
            align: 'center'
        },
        {
            xref: 'x',
            yref: 'paper',
            x: ${width / 1000 / 2},
            y: ${TOP},
            text: '${(width / 1000).toFixed(3)} ms',
            showarrow: false,
            font: { color: '#ccc', size: ${FONT_SIZE} },
            align: 'center'
        }
    ]
})
</script>
</body>

`
    return html
}