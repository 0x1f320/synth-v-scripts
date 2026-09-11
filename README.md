# Synthesizer V2 Userscripts

**English** · [한국어](README.ko.md)

[![CI](https://img.shields.io/github/actions/workflow/status/0x1f320/synth-v-scripts/ci.yml?style=flat&colorA=000000&colorB=000000)](https://github.com/0x1f320/synth-v-scripts/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/0x1f320/synth-v-scripts?include_prereleases&style=flat&colorA=000000&colorB=000000)](https://github.com/0x1f320/synth-v-scripts/releases)
[![license](https://img.shields.io/github/license/0x1f320/synth-v-scripts?style=flat&colorA=000000&colorB=000000)](LICENSE)

A collection of userscripts for [Synthesizer V Studio 2](https://dreamtonics.com/synthesizerv/).

## Features

### Advanced Playback — `playback.js`

A side panel that keeps the editor centered on whatever is currently playing.

- **Scroll following** — horizontal (time) and vertical (pitch) auto-scroll. Vertical scroll moves smoothly toward the median pitch of the notes around the playhead (1 before, 5 ahead), and you can adjust how long that movement takes (duration, in ms).
- **Track focusing** — automatically switches the current track/group to whatever plays under the playhead. Choose which tracks to consider, or toggle the whole feature off.
- **Playhead position** — a slider for where the playhead sits in the viewport while playing. Ranges from 0.05 to 0.95, where value × 100% is the horizontal position from the left (e.g. 0.25 → 25%).

### Parameter Control — `parameter-control.lua`

A side panel for applying a delta to parameter curves over the selected notes.

- Choose a base parameter, including Tone Shift, Mouth Opening, and Rap Intonation.
- Choose a base parameter or a specific **Vocal Mode** entry directly from the Target dropdown. Vocal mode entries are read from the selected group's defined vocal modes, falling back to the current group when no group is selected.
- Use **Define Preset...** at the end of the Target dropdown to create an in-memory preset. In the dialog, set a preset name and move the sliders for every target the preset should control; zero-valued sliders are ignored.
- Use **Extract Preset...** to create a preset from the current selection. The script samples enabled parameter and vocal mode values across the selected notes' quantized range, uses the median value for each detected target, and shows only detected targets in the preset dialog.
- Selecting a saved preset changes the Delta slider to percent mode. Applying a preset uses `entry amount * delta percent`, so a `0.5` Tension entry with Delta `50%` applies `0.25`.
- Adjust the delta with a slider, then apply it to the selected notes' time ranges.
- If no notes are selected, the script shows a warning dialog instead of editing the project.

### Hello World — `hello-world.js`

A minimal example script, handy as a template for new scripts.

## Installation

1. On the [Releases page](https://github.com/0x1f320/synth-v-scripts/releases), download the `.js` or `.lua` file(s) you want from the latest release (or any specific version).
2. Drop them into the Synthesizer V Studio 2 scripts folder:

   | OS | Path |
   | --- | --- |
   | macOS | `~/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts` |
   | Windows | `%APPDATA%\Dreamtonics\Synthesizer V Studio 2\scripts` |

3. Restart Studio 2 (or reopen the **Scripts** menu). The script appears under its menu entry.

> Tip: you can also open the scripts folder directly from the editor's **Scripts** menu.

## Development

Stack: **TypeScript** · **esbuild** (JS bundling) + **SWC** (ES5 downleveling) · **typescript-to-lua** (Lua bundling) · **Biome** (lint/format) · **semantic-release** · **pnpm**.

> Studio 2 JavaScript scripts are ES5-only — no arrow function, class, or `let`/`const` syntax. The JS build bundles each JS entry with esbuild and downlevels it with SWC. Parameter Control is distributed only as a Lua 5.4 bundle through typescript-to-lua.

```sh
pnpm install
pnpm build       # build JS scripts and the Lua-only Parameter Control bundle into dist/
```

| Command | Description |
| --- | --- |
| `pnpm build` | Build JS scripts and the Lua-only `parameter-control.lua` into `dist/`. |
| `pnpm build:js` | Type-check, bundle, and downlevel JavaScript script entries to `dist/*.js`; `src/parameter-control.ts` is intentionally excluded because Parameter Control is distributed only as Lua. |
| `pnpm build:lua` | Compile `src/parameter-control.ts` to `dist/parameter-control.lua`. |
| `pnpm typecheck` | Type-check only (`tsc --noEmit`). |
| `pnpm lint` | Lint with Biome. |
| `pnpm check` | Biome lint + format check. |
| `pnpm format` | Format the codebase with Biome. |

Most top-level `src/*.ts` files are JavaScript entry points; `src/parameter-control.ts` is a Lua-only entry compiled by `build:lua`. Shared code lives under `src/common` and `src/ui` and is imported via the `@/` alias, then inlined into each bundle at build time.

### Workflow

- **Always open a pull request** targeting `dev` — don't push straight to `dev` or `main`.
- **Use [Conventional Commits](https://www.conventionalcommits.org/)** — releases are fully automated with semantic-release:
  - `feat:` bumps the minor version; `fix:`, `perf:`, and `refactor:` bump the patch version.
  - Merging to **`dev`** publishes a prerelease (`x.y.z-dev.N`); merging to **`main`** publishes a stable release.
  - Each GitHub release attaches the built `dist/*.js` files and Lua bundles such as `dist/parameter-control.lua` as individual downloadable assets.

## License

[MIT](LICENSE)
