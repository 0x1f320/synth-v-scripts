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

### Hello World — `hello-world.js`

A minimal example script, handy as a template for new scripts.

## Installation

1. On the [Releases page](https://github.com/0x1f320/synth-v-scripts/releases), download the `.js` file(s) you want from the latest release (or any specific version).
2. Drop them into the Synthesizer V Studio 2 scripts folder:

   | OS | Path |
   | --- | --- |
   | macOS | `~/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts` |
   | Windows | `%APPDATA%\Dreamtonics\Synthesizer V Studio 2\scripts` |

3. Restart Studio 2 (or reopen the **Scripts** menu). The script appears under its menu entry.

> Tip: you can also open the scripts folder directly from the editor's **Scripts** menu.

## Development

Stack: **TypeScript** · **esbuild** (bundling) + **SWC** (ES5 downleveling) · **Biome** (lint/format) · **semantic-release** · **pnpm**.

> The Studio 2 scripting engine is ES5-only — no arrow functions, classes, or `let`/`const`. The build bundles each entry with esbuild and downlevels the result to ES5 with SWC, so the source stays modern TypeScript while the output runs in the editor.

```sh
pnpm install
pnpm build       # type-check, bundle, and downlevel every src/*.ts to dist/
```

| Command | Description |
| --- | --- |
| `pnpm build` | Type-check, bundle, and downlevel every `src/*.ts` to `dist/`. |
| `pnpm typecheck` | Type-check only (`tsc --noEmit`). |
| `pnpm lint` | Lint with Biome. |
| `pnpm check` | Biome lint + format check. |
| `pnpm format` | Format the codebase with Biome. |

Each `src/*.ts` is its own entry point; shared code lives under `src/common` and `src/ui` and is imported via the `@/` alias, then inlined into each bundle at build time.

### Workflow

- **Always open a pull request** targeting `dev` — don't push straight to `dev` or `main`.
- **Use [Conventional Commits](https://www.conventionalcommits.org/)** — releases are fully automated with semantic-release:
  - `feat:` bumps the minor version; `fix:`, `perf:`, and `refactor:` bump the patch version.
  - Merging to **`dev`** publishes a prerelease (`x.y.z-dev.N`); merging to **`main`** publishes a stable release.
  - Each GitHub release attaches the built `dist/*.js` files as individual downloadable assets.

## License

[MIT](LICENSE)
