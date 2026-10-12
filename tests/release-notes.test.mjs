import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exercise the generator actually bundled with semantic-release and our preset.
const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const { generateNotes } = await import(
  pathToFileURL(releaseRequire.resolve('@semantic-release/release-notes-generator'))
);
const config = JSON.parse(readFileSync(new URL('../.releaserc.json', import.meta.url)));
const [, options] = config.plugins.find(([name]) => name === '@semantic-release/release-notes-generator');

function notes(messages) {
  return generateNotes(options, {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    options: { repositoryUrl: 'https://github.com/0x1f320/synth-v-scripts.git' },
    commits: messages.map((message, index) => ({
      message,
      hash: String(index + 1).padStart(40, 'a'),
    })),
    lastRelease: { gitTag: 'v1.1.0-dev.3' },
    nextRelease: { version: '1.1.0-dev.4', gitTag: 'v1.1.0-dev.4' },
  });
}

test('release notes include changes, sections, and GitHub links', async () => {
  const result = await notes([
    'feat(playback): follow host playback state automatically (#10)',
    'fix(parameter-control): share presets by voicebank across projects (#12)',
    'perf: reduce polling overhead',
    'refactor: simplify preset loading',
    'chore(release): 1.1.0-dev.3 [skip ci]',
  ]);
  for (const section of ['Features', 'Bug Fixes', 'Performance Improvements', 'Code Refactoring']) {
    assert.ok(result.includes(`### ${section}`), result);
  }
  for (const change of ['follow host playback state', 'share presets by voicebank', 'reduce polling overhead', 'simplify preset loading']) {
    assert.ok(result.includes(change), result);
  }
  assert.match(result, /https:\/\/github.com\/0x1f320\/synth-v-scripts\/issues\/12/);
  assert.match(result, /compare\/v1\.1\.0-dev\.3\.\.\.v1\.1\.0-dev\.4/);
  assert.doesNotMatch(result, /\[skip ci\]/);
});

test('release notes preserve breaking changes', async () => {
  const result = await notes(['feat!: change preset storage\n\nBREAKING CHANGE: Save the project before choosing presets.']);
  assert.match(result, /BREAKING CHANGES/);
  assert.match(result, /Save the project before choosing presets\./);
});
