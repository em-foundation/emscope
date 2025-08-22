<p align="center">
    <img src=".github/images/logo.png" alt="EM•Scope Logo" width="400">
</p>
<br>
<p align="center">
    <img src=".github/images/tagline.png" alt="EM•Scope TagLine" width="750">
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
    <img src=".github/images/modes.png" alt="EM•Scope Modes" width="600">
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

> [!NOTE]
> Use the **Nordic PPK2** in _ampere mode_, as well as specify the target's nominal `-V --voltage` value.&thinsp; By combining the latter with the `-PS` options, we designate the target voltage which the **PPK2** will actually supply when in _source mode_.
>
> Unlike the **Joulescope JS220** &ndash; which captures **I** _and_ **V** signals &ndash; the **Nordic PPK2** does not record voltage.&thinsp; The `-V, --voltage` option (defaults to 3.3&thinsp;V) supplies this essential piece of information used when reporting power consumption.



