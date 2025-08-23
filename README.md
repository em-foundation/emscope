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

Enter `emscope -V` from the command-line to verify that installation has succeeded.&thinsp; You should also download and install the **Joulescope Application Software** (version 1.3.7) for your host computer from [here](https://download.joulescope.com/joulescope_install/index.html).

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

### recording raw power signals

```console
$ emscope grab -J
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> Capture raw data using an attached **Joulescope JS220** power analyzer, appropriately wired to your target system; by default, `emscope grab` records just three seconds of data.&thinsp; We'll explain more about the generated output shortly.

```console
$ emscope grab -PS
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!NOTE]
> Capture raw data, but now using an attached **Nordic PPK2** analyzer.&thinsp; This analyzer has two alternative operating modes (`-A, --ampere-mode` or `-S, --source-mode`) selected by an additional `emscope grab` option.

```console
$ emscope grab -PAV 1.8
    wrote 'capture.yaml'
    analyzing captured data...
    found 3 event(s)
    wrote 'analysis.yaml'
```

> [!TIP]
> The next series of examples run from the `ti-23-lp-slsdk-J` capture directory found in the `bleadv-captures` **Git** repository.&thinsp; Clone this repo and then command `emscope pack -u` within this folder, if you want to play along at home. 

### viewing captured information

```console
$ emscope view -s
    sleep current = 589.092 nA @ 3.29 V, standard deviation =  14.548 µA
```

> [!NOTE]
> The `-s, --sleep` option reports average power consumption during periods of inactivity within the target system &ndash; values that should align with a vendor data sheet.&thinsp; The standard deviation reflects  _recharge pulses_ which often occur during deep-sleep.

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

```
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

```
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
