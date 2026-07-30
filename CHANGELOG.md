## VERSION-26.0.0

- works with _new_ captures containing a `.platform` and `.power` declarations
- initial support of `em-foundation/bluejoule-adv` repo
- will **NOT** work with the `em-foundation/BlueJoule` repo
- `pack -a` also generates `about.json` for programmatic consumption
- human-readable `ABOUT.md` file is now fully-generated

## VERSION-25.6.1

- `emscope pack -a` fix

## VERSION-25.6.0

- improved processing of more complex captures
- new `emscope scan -s, --sleep-window <milleseconds>` option
- new `emscope view -w -e` combination to only use scanned events for scoring

## VERSION-25.5.0

- support for Otii-3 analyzer and battery emulator
- new `emscope grab -O, --otii3` option
- new `emscope grab -B, --battery-profile <index>` option
- new `emscope --soc <percent>` option

## VERSION-25-4.1

- more robust port enumeration fix for PPK

## VERSION-25-4.0

- added `--json` option
- port enumeration fix for PPK

## VERSION-25-3.0

- aligned with new `BlueJoule/capture` directory structure
- streamlined generation of `ABOUT.md` with automatic HW/SW inclusion
- one digit of precision after the decimal point in most results

## VERSION-25-2.0

- new `emscope grab -p, --ppk-supply` option
- new `emscope scan --refresh` option
- adds capture_time to generated .jls file
- minor bug fixes
- works with Joulescope UI 1.3.9

## VERSION-25-1.0

- uses `BlueJoule` repo as exemplar
- updated `README` documentation
- renamed `emscope grab -v, --voltage` option
- new `emscope scan -d, --min-duration` option
- new `emscope scan -e, --min-energy` option
- `emscope scan -t, --trim` option requires an event count
- new `emscope pack -a, --about-file` option
- new `emscope pack -z, --zip-file` option
- renamed `emscope pack -s, --status` option
- renamed `emscope pack --restore` option

## VERSION-25.0.1

- baseline release candidate
