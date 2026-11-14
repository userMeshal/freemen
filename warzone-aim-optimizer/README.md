# Warzone Aim Assist Optimizer

A Windows 11 desktop tool for controller players. It measures what your Xbox-compatible
controller really outputs, turns that into a tuned set of **Warzone controller settings**,
and proves the result with a repeatable aim benchmark that reports the actual percentage
change against your own baseline.

- Single native EXE (C++17, Win32 + GDI+ + XInput). No installer, no runtime, no drivers.
- Reads the controller through the standard XInput API. **It never touches the game**: no
  memory access, no input injection, no automated aiming, no overlay, nothing that
  interacts with anti-cheat. Settings are entered by you in the game's own menu.

**العربية:** الواجهة عربية بالكامل افتراضياً (من اليمين لليسار) - راجع [README.ar.md](README.ar.md).
The interface is Arabic (right-to-left) by default; switch with the **English / العربية** button at the
bottom of the sidebar, or start with `--lang en` / `--lang ar`.

## What it can and cannot do

| | |
|---|---|
| Can | Find the smallest deadzones your sticks support, detect drift, pick sensitivity / ADS / curve values from your measured aiming data, track your improvement as a number. |
| Cannot | Change the strength of Warzone's aim assist. Nothing outside the game legitimately can. |

The **2x goal** is a target for your *Aim Performance Index* (defined below), measured in the
built-in benchmark. The app only ever shows what you actually measured; reaching 2x depends
on your starting point, your hardware and practice. It is not guaranteed.

## Install and launch

1. Download `WarzoneAimOptimizer-win64.zip` from `dist/` and extract it anywhere
   (for example `C:\Tools\WarzoneAimOptimizer`).
2. Plug the controller in via USB.
3. Double-click `WarzoneAimOptimizer.exe`.
   The EXE is not code-signed, so Windows SmartScreen may show "Windows protected your PC":
   choose **More info > Run anyway**.

Data (profiles, calibration, run history, exported sheets) is stored in
`%APPDATA%\WarzoneAimOptimizer`. To uninstall, delete the EXE and that folder.

Keys: `F11` borderless fullscreen, `Esc` or controller `B` aborts a benchmark run.

Command-line options: `--demo` (simulated controller, to explore the UI without hardware;
results are flagged as simulated), `--data <folder>` (use a different data folder),
`--lang ar|en` (force the interface language), `--selfcheck <file>` (verify Arabic text
rendering on this machine and write a report).

## Recommended workflow

1. **Calibration** (30 s) - four guided tests: rest, flick-and-release, edge rotation, triggers.
2. **Benchmark > Baseline** - run it with the settings you play with today.
3. **Profiles & Tuning > Generate recommendation** - then *Apply to editor*, *Save*.
4. **Export sheet** - type the listed values into Warzone: Settings > Controller.
5. Play / practise with the new settings, then **Benchmark > Optimized**.
6. **Results** - baseline vs. new run, metric by metric, with percentage change and the
   progress bar towards 2x.

Change one thing at a time and give new sensitivity values a few sessions; the first run on
new settings is often worse than your baseline purely from muscle memory.

## How things are measured

**Calibration**

| Test | Measures | Used for |
|---|---|---|
| Rest | Mean resting offset, RMS noise, 99.9th percentile radius | Drift verdict |
| Release | Where the stick settles after each flick (still for 250 ms within a 0.02 box) | Worst centring error |
| Rotate | Maximum radius reached in each of 72 directions | Max deadzone, circularity |
| Triggers | Resting value and full-press value | Trigger deadzones |

Recommended **Min deadzone** = worst centre error + 0.015 margin, rounded up to 0.01
(never below 0.02). Recommended **Max deadzone** = weakest edge reach - 0.01, rounded down.
Drift verdict: < 0.03 excellent, < 0.07 normal, < 0.13 noticeable, otherwise severe.

**Benchmark** - three stages with a fixed seed, so every run faces the same targets:

1. *Flick & fire* - targets appear 10-38 degrees away; aim and fire with RT.
2. *Tracking* - keep the crosshair on a strafing target (random speed and direction changes).
3. *ADS precision* - hold LT and hit small targets.

Optionally, dial in trainer aim assist (0x-3x) to experiment - see below.

| Metric | Definition |
|---|---|
| Accuracy | hits / (shots + timed-out targets) |
| Reaction time | target appears -> aim has closed 8 % (min 1 degree) of the distance, median |
| Time to hit | target appears -> hit, median; a timed-out target counts as the full 4 s |
| Tracking | fraction of time on target, and mean angular error |
| Consistency | 1 - variability of time-to-hit and of per-second tracking, earned only on targets actually hit / time actually on target |
| Composite score | 0-100: 30 % accuracy, 30 % tracking, 20 % reaction, 20 % consistency |
| **Aim Performance Index** | `100 x accuracy x trackingQuality x (1 / medianTimeToHit_s) x (0.5 + 0.5 x consistency)` |

`trackingQuality = 0.7 x onTarget + 0.3 x exp(-meanError / 4 deg)`. The index has no upper
bound, which is what makes "2x the baseline" a checkable target.

The trainer applies your profile's deadzone, response curve, sensitivity and ADS multiplier
to the stick. Its turn-rate model (sensitivity N = N x 30 deg/s at full stick) and curve shapes
are approximations for training and comparison, not a copy of the game's internals. Compare
runs of the same length (Full with Full, Quick with Quick).

**Adjustable trainer aim assist (0x-3x)** - a slider on the Benchmark page. At `0x` (default)
the trainer measures your raw stick control, which is what the game's aim assist is built on;
leave it off for baseline vs optimized comparisons. Above `0x` it adds a trainer-only
approximation of aim assist so you can feel and measure how assist strength changes your
accuracy and tracking:

- *Slowdown* - the player's aim is damped as the crosshair nears a target (up to ~90 % at 3x).
- *Rotational* - while you are strafing, the view is pulled toward the target.

This model runs **only inside this program's training arena**. It does not and cannot change
Warzone's own aim assist - nothing outside the game legitimately can. Each run records the
strength it used; the Results page refuses to treat runs at different strengths as a fair
comparison and labels any assisted run plainly.

**Recommendations** - every suggested value is listed with its reason:

- Deadzones: from calibration only.
- Sensitivity: -1 / -2 if you overshoot more than 35 % / 60 % of targets, +1 if the stick is
  pinned more than 45 % of flick time with few overshoots; otherwise unchanged.
- ADS multiplier: lowered when ADS-stage hit rate is under 75 %, raised when accurate but slow.
- Curve, ADS transition: from the Precision <-> Responsiveness slider (Linear only when your
  data shows low overshoot and low tracking variance).

Menu names in Warzone change between seasons; match by meaning if a label differs.

## Building from source

Windows (Visual Studio 2022 with "Desktop development with C++", plus CMake):

```bat
build-windows.bat
```

Output: `build\Release\WarzoneAimOptimizer.exe`. Tests: `build\Release\wz_core_tests.exe`.

Linux cross-compile (what the shipped EXE was built with - MinGW-w64 GCC 13):

```sh
sudo apt install g++-mingw-w64-x86-64-posix cmake ninja-build
./build-cross.sh        # builds build/win/*.exe and dist/WarzoneAimOptimizer-win64.zip
```

## Layout

```
src/core/      portable logic: curves, stick analysis, benchmark, recommender, storage
src/platform/  XInput source, simulated source, 1 kHz sampling thread
src/ui/        GDI+ immediate-mode UI and the six pages
tests/         headless tests for src/core
tools/         gen_arabic.py - the Arabic translation table (generates src/core/LangArabic.cpp)
```

## Languages

All interface text goes through `wz::tr()`; English strings are the keys and Arabic comes from
`tools/gen_arabic.py`. In Arabic the whole layout is mirrored, except things that have a
physical orientation - stick scopes, graphs and the training arena stay unflipped, and the left
stick / left trigger stay on the physical left. Recommendations and the exported settings sheet
are produced in the selected language (the Arabic sheet keeps each option's English menu name
next to it so it can be matched in the game).

## Verification status

Verified in the build environment (Linux, MinGW-w64 cross-compiler, Wine 9):

- Compiles and links with no warnings (`-Wall -Wextra`); EXE imports only Windows system DLLs.
- Core checks pass both natively and as a Windows EXE under Wine, including a check that every
  Arabic translation keeps the same format arguments as its English source.
- GUI exercised under Wine with the simulated controller in both languages: all six pages, the
  full calibration sequence, recommendation, profile save / load, sheet export, complete
  benchmark runs (with and without trainer aim assist), history and before/after comparison;
  plus the no-controller state. In Arabic: mirrored layout, mouse hit-testing and physical
  left/right placement.

Verified on real Windows by the CI workflow (windows-latest, MSVC): the build, the core checks,
an 8-second launch, and `--selfcheck`, which confirms on real GDI+ that Arabic letters are
joined, paragraphs run right-to-left, and embedded numbers keep their order.

**Not** verified, because no Windows desktop or physical controller was available: how the
Arabic interface looks on a real display (Wine cannot shape Arabic, so its screenshots show
unjoined letters), behaviour with a real XInput device, high-DPI scaling, and frame pacing on a
high-refresh monitor.
