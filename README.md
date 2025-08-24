<p align="center">
    <img src="docs/images/logo.png" alt="EM•Scope Logo" width="400">
</p>
<br>
<p align="center">
    <img src="docs/images/tagline.png" alt="EM•Scope TagLine" width="750">
</p>

<br>
<br>
<br>

<p align="right">
  <a href="README.md"><sup>for a better view <b>&#x27a6;</b></sup></a>
</p>

-----

<h3 align="center">
  <a href="#installation">Installation</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#basic-usage">Basic Usage</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#examples">Examples</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#contributing">Contributing</a>&nbsp;&#xFF5C;&nbsp;
  <a href="#license">License</a>
</h3>

<br>

The **EM&bull;Scope** tool streamlines the capture, analysis, display, and delivery of real-time power-consumption measurements &ndash; used to characterize the overall energy efficiency of resource-constrained embedded systems.&thinsp; To encourage benchmarks for different HW/SW configurations performing comparable tasks, **EM&bull;Scope** introduces a novel metric for quantifying energy efficiency &ndash; the **EM&bull;erald**.
 
## Installation

```
npm install -g @em-foundation/emscope
```

> [!IMPORTANT]
> Until the 25.1.0 release of **EM&bull;Scope**, use
> ```
> npm install -g https://github.com/em-foundation/npm-packages/releases/download/resources/emscope-25.0.1.tgz
> ```

Enter `emscope -V` from the command-line to verify that installation has succeeded.&thinsp; You should also download and install the **Joulescope Application Software** (version 1.3.8) for your host computer from [here](https://download.joulescope.com/joulescope_install/index.html).

## Basic Usage

**EM&bull;Scope** has four primary modes of operation, corresponding to these `emscope` sub-commands:

<p align="center">
    <img src="docs/images/modes.png" alt="EM•Scope Modes" width="600">
</p>

> [!TIP]
> Use `emscope help [sub-command]` to refresh your memory as well as to explore further.

Use of **EM&bull;Scope** centers around a _capture directory_ &ndash; populated initially with raw signal data acquired through the `emscope grab` sub-command.&thinsp;  Within the latter mode, you'll physically connect a **Joulescope** [JS220](https://www.joulescope.com/products/js220-joulescope-precision-energy-analyzer) or **Nordic** [PPK2](https://www.nordicsemi.com/Products/Development-hardware/Power-Profiler-Kit-2) to your target embedded system.

In practice, you'll typically begin using **EM&bull;Scope** with captures previously grabbed by others and then published within a curated **Git** repository.&thinsp; To support the examples which follow, go ahead and clone the [em-foundation/bleadv-captures](https://github.com/em-foundation/bleadv-captures) repo.

> [!NOTE]
> All of these captures record the energy consumped by different embedded HW/SW configurations otherwise performing the _same_ application task &ndash; transmitting a stock BLE packet on all three advertising channels once per-second with 0&thinsp;dB of radio power.
>
> We hope this embryonic repository will encourage others to contribute captures for a wide range of embedded BLE systems &ndash; enabling more rational and robust comparative benchmarks between different HW/SW providers who all claim "ultra-low-power".

Use the `emscope pack --unpack` command to first deflate a special file named `emscope-capture.zip` found in each of the repository's labeled capture directories.

At this stage, you can use the `emscope scan` and `emscope view` sub-commands to explore the raw signal data captured at an earlier time &ndash; as if you had just commanded `emscope grab`.

Only the original supplier of the raw data, however, would use `emscope pack` to create `emscope-capture.zip`.&thinsp; The supplier would then commit this file (and other **EM&bull;Scope** artifacts) into the capture repository &ndash; ready for downstream consumption by others.

## Examples

### 🟠&ensp;recording raw power signals

```console
$ emscope grab -J
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> Capture raw data using an attached **Joulescope JS220** power analyzer, appropriately wired to your target system; by default, `emscope grab` records just three seconds of data.&thinsp; We'll explain more about the generated output shortly.

<br> 

```console
$ emscope grab -PS
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> Capture raw data, but now using an attached **Nordic PPK2** analyzer.&thinsp; This analyzer has two alternative operating modes (`-A, --ampere-mode` or `-S, --source-mode`) selected by an additional `emscope grab` option.

<br> 

```console
$ emscope grab -PAV 1.8
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```
<br> 

> [!TIP]
> The next series of examples run from the `ti-23-lp-slsdk-J` capture directory found in the `bleadv-captures` **Git** repository.&thinsp; Clone this repo and then command `emscope pack -u` within this folder, if you want to play along at home. 

### 🟠&ensp;viewing captured information

```console
$ emscope view -s
    sleep current = 589.092 nA @ 3.29 V, standard deviation =  14.548 µA
```

> [!NOTE]
> The `-s, --sleep` option reports average power consumption during periods of inactivity within the target system &ndash; values that should align with a vendor data sheet.&thinsp; The standard deviation reflects  _recharge pulses_ which often occur during deep-sleep.

<br> 

```console
$ emscope view -e
    A :: time =  1.06 s, energy =  30.840 µJ, duration =   3.250 ms
    B :: time =  2.07 s, energy =  30.910 µJ, duration =   3.250 ms
    C :: time =  3.07 s, energy =  30.913 µJ, duration =   3.250 ms
    D :: time =  4.07 s, energy =  30.962 µJ, duration =   3.000 ms
    E :: time =  5.08 s, energy =  30.945 µJ, duration =   3.000 ms
    F :: time =  6.08 s, energy =  31.166 µJ, duration =   3.250 ms
    G :: time =  7.09 s, energy =  30.863 µJ, duration =   3.000 ms
    H :: time =  8.10 s, energy =  30.745 µJ, duration =   3.000 ms
    I :: time =  9.10 s, energy =  31.252 µJ, duration =   3.000 ms
    J :: time = 10.10 s, energy =  30.931 µJ, duration =   3.000 ms
    ----
    average energy over 10 event(s):  30.953 µJ
```

> [!NOTE]
> The `-e, --events` option lists information about each period of _activity_ detected in the raw signal data.&thinsp; When benchmarking different HW/SW target configurations, 10 one-second event cycles provides a reasonable sample set.  

<br> 

```console
$ emscope view -j
    wrote 'ti-23-lp-slsdk-J-events.jls'
    launching the Joulescope File Viewer...
```

> [!NOTE]
> The `-j, --jls-file` option launches the **Joulescope File Viewer** (installed earlier) with a generated `.jls` file containing the raw signal data, annotated with markers deliniating each of the active events listed earlier.
>
><p align="center">
>    <img src="docs/images/joulescope.png" alt="Joulescope File Viewer" width="850">
></p>

> [!TIP]
> Somewhat daunting at first, take some time to familiarize yourself with the **Joulescope File Viewer**.&thinsp; As you start zooming in on portions of the capture &ndash; and perhaps find yourself a little lost &ndash; simply exit the program and re-run the `emscope view -j` command.

<br> 

```console
$ emscope view -jB
    wrote 'ti-23-lp-slsdk-J-event-B.jls'
    launching the Joulescope File Viewer...
    generated 'ti-23-lp-slsdk-J-event-B.png'
```
> [!NOTE]
> This form of the `-j, --jls-file` option focuses upon a _single_ event designated through an alphabetic identifier seen earlier in the output of the `emscope view -s` command.&thinsp; This variant also generates a screenshot of the event, suitable for publication.
> 
><p align="center">
>    <img src="docs/images/event.png" alt="EM•Scope Event Image" width="850">
></p>

### 🟠&ensp;refining event detection

```console
$ emscope scan
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> This command performs a baseline analysis of the raw signal data, discriminating event activity from periods of deep-sleep.&thinsp; Saving results to `analysis.yaml`, the `emscope grab` command seen earlier in fact performs an initial `emscope scan` after recording the data.

<br> 

```console
$ emscope scan -t
    analyzing captured data...
    found 1 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> The `-t, --trim` option will typically drop the first and last events its analysis, ensuring that at least 500&thinsp;ms of inactivity occur on either end of the newly scanned data.&thinsp; If all goes well, a capture of duration _n+2_ seconds should yield a clean set of _n_ events. 

<br> 

```console
$ emscope scan -tg 5
    analyzing captured data...
    found 1 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> Adding in the `-g, --gap <milliseconds>` option coalesces adjacent events whose separation falls under a given threshold.&thinsp; Benign in most cases, this filter nevertheless has proven useful when working with some target systems.

<br>

> [!IMPORTANT]
> The `emscope scan` command will _always_ (re-)write the `analysis.yaml` file in the current capture directory.&thinsp; Along with the `capture.yaml` file written initially by `emscope grab`, this pair of special files source much of the information presented through the `emscope view` command &ndash; often used in tandem with `emscope view` to refine the event analysis _before_ publishing the capture itself.

> [!TIP]
> Feel free, however, to use `emscope scan` within any of the capture directories published in the `bleadv-captures` **Git** repository &ndash; implicitly modifying some `analysis.yaml` file.&thinsp; To revert `ble-captures` to its original state, run the following command anywhere inside the repo:
> ```
> git -C "$(git rev-parse --show-toplevel)" reset --hard
> ```

### 🟠&ensp;publishing captured information

```
emscope pack
... prepare other capture directory artifacts
git commit ...   
```

> [!NOTE]
> By convention, you'll publish new captures created with `emscope grab` and refined with `emscope scan` within a **Git** repo.&thinsp; At a minimum, you'll commit the `capture.yaml` and `analysis.yaml` files described earlier as well as the (large) `emscope-capture.zip` generated here.
>
> Owners of the repo will often prescribe other required artifacts (such as a `README`) as well as naming conventions for the capture directory itself.&thinsp; The repo will _not_ in general retain generated `.jls` files &ndash; which clients can always reproduce with `emscope view` after cloning.

### 🟠&ensp;scoring energy efficiency

```console
$ emscope view -w
    average sleep power:   1.941 µW
    event cycle duration: 00:00:01
    ----
    representative event:  30.980 µJ
    energy per cycle:  32.921 µJ
    energy per day:   2.844 J
    ----
    28.13 EM•eralds
```

> [!NOTE]
> The `-w, --what-if` option summarizes the energy efficiency of previously captured power signals.&thinsp; Like all forms of `emscope view`, the underlying `analysis.yaml` file provides a source for this information but otherwise remains unmodified by this command.
>
> As you might imagine, the overwhelming percentage of energy consumed per 1&thinsp;s event-cycle happens in under 1% of real-time &ndash; an inherent and enduring trait of most "sleepy" applications for embedded systems.

<br>

```console
$ emscope view -w 5
    average sleep power:   1.941 µW
    event cycle duration: 00:00:05
    ----
    representative event:  30.980 µJ
    energy per cycle:  40.684 µJ
    energy per day: 703.019 mJ
    ----
    113.79 EM•eralds
```

> [!NOTE]
> The `-w, --what-if` accepts an optional value defining the event cycle duration in `hh:mm:ss` format &ndash; allowing us to extrapolate energy consumption in longer, more realistic periods.&thinsp; As expected, increasing cycle duration will _decrease_ energy consumption per day.

<br>

```console
$ emscope view --score
    28.13 EM•eralds
$ emscope view -w 5 --score
    113.79 EM•eralds
```

>[!NOTE]
> Using the `--score` option by itself (or in conjunction with `-w`) funnels the output to a single metric &ndash; the **EM•erald**.&thinsp; Starting with _energy per day_ value (as reported earlier), we compute _energy per month_ and then divide this value into 2400 &ndash; yielding our final score.
>
> Why 2400&thinsp;???&thinsp; Because this number approximates the amount of energy available in the ever-popular CR2032 coin-cell battery &ndash; rated at 220&thinsp;mAH and nominally delivering 3V.
>
><p align="center"><b>CR2032 energy:&nbsp; 225 mAh × 3.6 × 3.0 V ≈ 2.43 kJ</b></p>
><p align="center"><b>1 EM•erald ≈ 1 CR2032-month</b></p>
>
> More **EM•eralds**, more efficiency....&thinsp; And while our embedded system may use alternatives to the CR2032 battery as its source of energy, the industry has always touted _"five years on a coin-cell"_ as a laudable goal &ndash; which we'll now term a <i>60 <b>EM•erald</b> application</i>.

<br>

```console
$ emscope view --score -C '*-J'

adi-m17-evk-msdk-J:
    14.75 EM•eralds

in-100-dk-none-J:
    41.92 EM•eralds

nrf-52-dk-zephyr-J:
    27.72 EM•eralds

nrf-54-dk-zephyr-J:
    41.93 EM•eralds

ti-23-lp-emsdk-J:
    48.62 EM•eralds

ti-23-lp-slsdk-J:
    28.13 EM•eralds
```

