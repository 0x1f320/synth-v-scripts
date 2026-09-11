# Synthesizer V2 Userscripts

[English](README.md) · **한국어**

[![CI](https://img.shields.io/github/actions/workflow/status/0x1f320/synth-v-scripts/ci.yml?style=flat&colorA=000000&colorB=000000)](https://github.com/0x1f320/synth-v-scripts/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/0x1f320/synth-v-scripts?include_prereleases&style=flat&colorA=000000&colorB=000000)](https://github.com/0x1f320/synth-v-scripts/releases)
[![license](https://img.shields.io/github/license/0x1f320/synth-v-scripts?style=flat&colorA=000000&colorB=000000)](LICENSE)

[Synthesizer V Studio 2](https://dreamtonics.com/synthesizerv/)용 유저스크립트 모음입니다.

## 기능

### Advanced Playback — `playback.js`

재생 중인 위치에 에디터를 계속 맞춰 따라가게 하는 사이드 패널.

- **Scroll following** — 가로(시간)·세로(피치) 자동 스크롤. 세로 스크롤은 플레이헤드 주변 노트(이전 1개, 이후 5개)의 중앙 피치로 부드럽게 이동하며, 이동하는 데 걸리는 시간(duration, ms)을 조절할 수 있습니다.
- **Track focusing** — 플레이헤드 아래에서 재생 중인 그룹으로 현재 트랙/그룹을 자동 전환. 대상 트랙을 선택하거나 기능 전체를 끌 수 있습니다.
- **Playhead position** — 재생 중 플레이헤드가 뷰포트에서 위치할 지점을 정하는 슬라이더. 0.05 ~ 0.95까지 설정할 수 있으며, 값 × 100%가 왼쪽 기준 가로 위치입니다 (예: 0.25 → 25%).

### Parameter Control — `parameter-control.lua`

선택한 노트 구간의 파라미터 커브에 델타를 적용하는 사이드 패널.

- Tone Shift, Mouth Opening, Rap Intonation을 포함한 기본 파라미터를 선택할 수 있습니다.
- Target 드롭다운에서 기본 파라미터 또는 특정 **Vocal Mode** 항목을 직접 선택할 수 있습니다. Vocal Mode 항목은 선택된 그룹에 정의된 값을 읽고, 선택된 그룹이 없으면 현재 그룹을 기준으로 합니다.
- Target 드롭다운 끝의 **Define Preset...**으로 메모리 내 프리셋을 만들 수 있습니다. 다이얼로그에서 프리셋 이름을 정하고, 프리셋이 제어할 대상의 슬라이더를 조절합니다. 값이 0인 항목은 무시됩니다.
- **Extract Preset...**으로 현재 선택 영역에서 프리셋을 만들 수 있습니다. 선택된 노트의 퀀타이즈 구간에서 활성화된 파라미터와 Vocal Mode 값을 샘플링하고, 감지된 각 대상의 중간값을 사용하며, 프리셋 다이얼로그에는 감지된 대상만 표시됩니다.
- 저장된 프리셋을 선택하면 Delta 슬라이더가 퍼센트 모드로 바뀝니다. 프리셋 적용 시 `항목 값 * delta percent`가 사용되므로, Tension 항목이 `0.5`이고 Delta가 `50%`라면 `0.25`가 적용됩니다.
- 슬라이더로 델타를 조절한 뒤 선택한 노트의 시간 구간에 적용합니다.
- 선택된 노트가 없으면 프로젝트를 편집하지 않고 경고 다이얼로그를 표시합니다.

### Hello World — `hello-world.js`

새 스크립트 작성용 최소 예제/템플릿.

## 설치 방법

1. [Releases 페이지](https://github.com/0x1f320/synth-v-scripts/releases)에서 최신 릴리즈 또는 원하는 특정 버전의 `.js` 또는 `.lua` 파일을 내려받습니다.
2. Synthesizer V Studio 2 스크립트 폴더에 넣습니다:

   | OS | 경로 |
   | --- | --- |
   | macOS | `~/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts` |
   | Windows | `%APPDATA%\Dreamtonics\Synthesizer V Studio 2\scripts` |

3. Studio 2를 재시작(또는 **Scripts** 메뉴 다시 열기). 스크립트가 메뉴에 나타납니다.

> 팁: 스크립트 폴더는 에디터의 **Scripts** 메뉴에서 바로 열 수도 있습니다.

## 개발

스택: **TypeScript** · **esbuild**(JS 번들링) + **SWC**(ES5 다운레벨) · **typescript-to-lua**(Lua 번들링) · **Biome**(린트/포맷) · **semantic-release** · **pnpm**.

> Studio 2 JavaScript 스크립트는 ES5 전용입니다 — arrow function, class, `let`/`const` 미지원. JS 빌드는 각 JS 엔트리를 esbuild로 번들한 뒤 SWC로 ES5까지 낮춥니다. Parameter Control은 typescript-to-lua를 통해 Lua 5.4 번들로만 배포됩니다.

```sh
pnpm install
pnpm build       # JS 스크립트와 Lua-only Parameter Control 번들을 dist/로 빌드
```

| 명령어 | 설명 |
| --- | --- |
| `pnpm build` | JS 스크립트와 Lua-only `parameter-control.lua`를 `dist/`로 빌드. |
| `pnpm build:js` | JavaScript 스크립트 엔트리를 타입체크·번들·ES5 다운레벨해 `dist/*.js`로 출력. `src/parameter-control.ts`는 Parameter Control이 Lua로만 배포되기 때문에 의도적으로 제외됩니다. |
| `pnpm build:lua` | `src/parameter-control.ts`를 `dist/parameter-control.lua`로 컴파일. |
| `pnpm typecheck` | 타입체크만 (`tsc --noEmit`). |
| `pnpm lint` | Biome 린트. |
| `pnpm check` | Biome 린트 + 포맷 검사. |
| `pnpm format` | Biome로 코드 포맷. |

대부분의 top-level `src/*.ts` 파일은 JavaScript 엔트리이며, `src/parameter-control.ts`는 `build:lua`로 컴파일되는 Lua-only 엔트리입니다. 공용 코드는 `src/common`·`src/ui`에 두고 `@/` 별칭으로 임포트해 빌드 시 각 번들에 인라인됩니다.

### 작업 방식

- **항상 PR로 올리기** — 대상은 `dev`. `dev`/`main`에 직접 push 금지.
- **[Conventional Commits](https://www.conventionalcommits.org/) 사용** — semantic-release로 릴리즈가 완전 자동화됩니다:
  - `feat:` → minor, `fix:`/`perf:`/`refactor:` → patch.
  - **`dev`** 머지 → 프리릴리즈(`x.y.z-dev.N`), **`main`** 머지 → 정식 릴리즈.
  - 각 GitHub 릴리즈에 빌드된 `dist/*.js` 파일과 `dist/parameter-control.lua` 같은 Lua 번들이 개별 다운로드 에셋으로 첨부됩니다.

## 라이선스

[MIT](LICENSE)
