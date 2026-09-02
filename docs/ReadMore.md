<p align="center">
    <img src="images/logo.png" alt="EM•Scope Logo" width="400">
</p>
<br>
<p align="center">
    <img src="images/tagline.png" alt="EM•Scope TagLine" width="750">
</p>

<p align="center"><sub>This introduction reflects EM&bull;Scope 26.1.1.</sub></p>

---

<a id="toc"></a>

<h3 align="center">
  <a href="#installation">Installation</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#usage">Usage</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#examples">Examples</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#contributing">Contributing</a>
</h3>

<br>

The **EM&bull;Scope** tool streamlines the capture, analysis, display, and delivery of real-time power-consumption measurements for resource-constrained embedded systems.

## Installation

```
npm install -g @em-foundation/emscope
```

Enter `emscope -V` from the command-line to verify the installation.

When using a **Joulescope JS220**, also install the **Joulescope Application Software** [version 1.3.9](https://download.joulescope.com/joulescope_install/index.html).

## Usage

**EM&bull;Scope** has four main modes of operation, corresponding to these `emscope` sub-commands:

<p align="center">
    <img src="images/modes.png" alt="EM•Scope Modes" width="600">
</p>

> [!TIP]
> Use `emscope help [sub-command]` to refresh your memory as well as to explore further.

Use of **EM&bull;Scope** centers around a _capture directory_.&thinsp; The `grab` command records raw signal data; `scan` analyzes that data; `view` presents the results; and `pack` prepares a capture for distribution.

You'll often begin with captures published by others within a curated **Git** repository.&thinsp; The examples which follow use the [em-foundation/bluejoule-adv](https://github.com/em-foundation/bluejoule-adv) benchmark repo.

## Examples

### 🟠&ensp;recording raw power signals &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

<a id="grab"></a>

```console
$ emscope grab -J -d 12
    wrote 'capture.yaml'
    analyzing captured data...
    found 12 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> This example records 12 seconds of raw signal data using an attached **Joulescope JS220**.&thinsp; Use `-P` for a **Nordic PPK2** or `-O` for a **Qoitech Otii** analyzer.
>
> The `grab` command writes `capture.yaml`, saves the raw signals locally, and performs an initial analysis which it records in `analysis.yaml`.

<br>

### 🟠&ensp;refining captured information &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

```console
$ emscope scan -t10 --event-window 5
    analyzing captured data...
    found 10 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> The `scan` command locates active events and measures periods of deep-sleep.&thinsp; The `-t, --trim` option selects a specific number of events, while `--event-window` fixes the scoring window used for each event.
>
> Here, EM&bull;Scope selects 10 events and scores each over a fixed 5&thinsp;ms window.

For more difficult captures, `scan` also provides options which combine nearby events or reject events that are too short or consume too little energy.&thinsp; Run `emscope scan -h` for details.

For later reference, `analysis.yaml` records the options used to refine the event set.

---

```console
$ emscope scan --refresh --event-window 5
```

> [!NOTE]
> The `--refresh` option re-runs analysis using the options already recorded in `analysis.yaml`.&thinsp; Additional command-line options override or extend those saved settings.
>
> This provides a simple way to migrate older captures as EM&bull;Scope analysis evolves.&thinsp; The raw capture data and `capture.yaml` remain unchanged.

<br>

### 🟠&ensp;viewing captured information &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

```console
$ emscope view -s
    sleep current = 0.4 µA @ 3.0 V, standard deviation = 11.9 µA
    sleep window = 2.710 s .. 3.110 s (0.400 s)
    accounting window = 0.110 s .. 10.110 s (10.000 s)
    event duration = 0.050 s
    event duty = 0.500%
    measured current = 6.1 µA
    modeled current = 6.0 µA
    closure residual = 2.113%
    floor residual = -129.8 nA
```

> [!NOTE]
> The `-s, --sleep-info` option summarizes both deep-sleep behavior and the boundaries used to account for the capture.&thinsp; The measured and modeled current values provide a simple closure check on the event/sleep partition.

---

<a id="view-e"></a>

```console
$ emscope view -e
    A :: time =  0.61 s, energy = 16.9 µJ, duration =  5.00 ms
    B :: time =  1.61 s, energy = 16.9 µJ, duration =  5.00 ms
    ...
    J :: time =  9.61 s, energy = 16.9 µJ, duration =  5.00 ms
    ----
    average energy over 10 event(s): 16.9 µJ
    average duration over 10 event(s):  5.0 ms
```

> [!NOTE]
> The `-e, --event-info` option lists each analyzed event and summarizes event energy and duration.

---

```console
$ emscope view -j
    wrote 'events.jls'
    launching the Joulescope File Viewer...
```

> [!NOTE]
> The `-j, --jls-file` option launches the **Joulescope File Viewer** with a generated `.jls` file annotated with the analyzed events.
>
> <p align="center">
>    <img src="images/joulescope.png" alt="Joulescope File Viewer" width="850">
> </p>

<br>

### 🟠&ensp;publishing captured information &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

```console
$ emscope pack -a
    ...
```

> [!NOTE]
> The `pack -a` command generates both `ABOUT.md` and `about.json`.&thinsp; These files summarize the capture, event and sleep measurements, boundary / closure information, and the activity, platform, and power declarations resolved through **PEDS**.
>
> Do not edit generated ABOUT files by hand.&thinsp; Re-run `emscope pack -a` whenever capture analysis or declarations change.

Use `emscope pack -z` when you also need to generate the distributable `emscope-capture.zip`.

<br>

### 🟠&ensp;scoring energy efficiency &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

```console
$ emscope view -w
    event period:        00:00:01
    average sleep power:   8.1 µW
    average event energy: 24.1 µJ
    average event duration:  5.0 ms
    ----
    energy per period:    32.1 µJ
    energy per day:        2.8 J
    ----
    28.84 EM•eralds
```

> [!NOTE]
> The `-w, --what-if` option combines measured sleep power with event energy and duration to estimate energy consumption for a selected event period.

Try other event periods directly:

```console
$ emscope view -w 5
$ emscope view -w 2:00
```

Or reduce the output to the **EM&bull;erald** score:

```console
$ emscope view --score
    28.84 EM•eralds
```

<p align="center"><b>EM&bull;eralds = 80 / <i>Joules per day</i></b></p>

Benchmark interpretation and comparisons belong at [bluejoule.org](https://bluejoule.org).

<br>

<a id="updating"></a>

### 🟠&ensp;updating EM&bull;Scope &emsp; <p align="right"><sup><a href="#toc">top ⤴️</a></sup></p>

Re-run the installation command at any time to ensure you have the latest published package:

```
npm install -g @em-foundation/emscope
emscope -V
```

---

### Enjoy the ride&thinsp;!!! **🎢**

<br>

## Contributing

At this early stage of development, the **EM&bull;Scope** team has four requests to the community at large:

🟢 &ensp; re-read this introduction &ndash; and start a Q/A thread on our [Discussion](https://github.com/em-foundation/emscope/discussions/new?category=q-a) page<br>
🟢 &ensp; play with the `emscope` command &ndash; and file [Bug](https://github.com/em-foundation/emscope/issues/new?template=bug_report.md) or [Feature](https://github.com/em-foundation/emscope/issues/new?template=feature_request.md) issues when needed<br>
🟢 &ensp; study or [**Fork**](https://github.com/em-foundation/bluejoule-adv)🍴&thinsp;`bluejoule-adv` as an example capture repository<br>
🟢 &ensp; encourage others to engage with **EM&bull;Scope** &ndash; and then [**Star**](https://github.com/em-foundation/emscope)⭐&thinsp; **&bull;** &thinsp;[**Watch**](https://github.com/em-foundation/emscope)👀 this repo<br>
