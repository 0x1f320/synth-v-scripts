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

### Hello World — `hello-world.js`

새 스크립트 작성용 최소 예제/템플릿.

## 설치 방법

1. [Releases 페이지](https://github.com/0x1f320/synth-v-scripts/releases)에서 최신 릴리즈 또는 원하는 특정 버전의 `.js` 파일을 내려받습니다.
2. Synthesizer V Studio 2 스크립트 폴더에 넣습니다:

   | OS | 경로 |
   | --- | --- |
   | macOS | `~/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts` |
   | Windows | `%APPDATA%\Dreamtonics\Synthesizer V Studio 2\scripts` |

3. Studio 2를 재시작(또는 **Scripts** 메뉴 다시 열기). 스크립트가 메뉴에 나타납니다.

> 팁: 스크립트 폴더는 에디터의 **Scripts** 메뉴에서 바로 열 수도 있습니다.

## 개발

스택: **TypeScript** · **esbuild**(번들링) + **SWC**(ES5 다운레벨) · **Biome**(린트/포맷) · **semantic-release** · **pnpm**.

> Studio 2 스크립팅 엔진은 ES5 전용입니다 — arrow function, class, `let`/`const` 미지원. 그래서 각 엔트리를 esbuild로 번들한 뒤 SWC로 ES5까지 낮춥니다. 덕분에 소스는 모던 TypeScript를 유지하면서 출력은 에디터에서 동작합니다.

```sh
pnpm install
pnpm build       # 타입체크 + 번들 + ES5 다운레벨 → dist/
```

| 명령어 | 설명 |
| --- | --- |
| `pnpm build` | 모든 `src/*.ts`를 타입체크·번들·ES5 다운레벨해 `dist/`로 출력. |
| `pnpm typecheck` | 타입체크만 (`tsc --noEmit`). |
| `pnpm lint` | Biome 린트. |
| `pnpm check` | Biome 린트 + 포맷 검사. |
| `pnpm format` | Biome로 코드 포맷. |

각 `src/*.ts`는 독립 엔트리 포인트이며, 공용 코드는 `src/common`·`src/ui`에 두고 `@/` 별칭으로 임포트해 빌드 시 각 번들에 인라인됩니다.

### 작업 방식

- **항상 PR로 올리기** — 대상은 `dev`. `dev`/`main`에 직접 push 금지.
- **[Conventional Commits](https://www.conventionalcommits.org/) 사용** — semantic-release로 릴리즈가 완전 자동화됩니다:
  - `feat:` → minor, `fix:`/`perf:`/`refactor:` → patch.
  - **`dev`** 머지 → 프리릴리즈(`x.y.z-dev.N`), **`main`** 머지 → 정식 릴리즈.
  - 각 GitHub 릴리즈에 빌드된 `dist/*.js`가 개별 다운로드 에셋으로 첨부됩니다.

## 라이선스

[MIT](LICENSE)
