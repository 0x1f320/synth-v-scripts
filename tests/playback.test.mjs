import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../dist/playback.js", import.meta.url), "utf8");

function setup(initialStatus = "stopped") {
  let status = initialStatus;
  let now = 0;
  let scrolls = 0;
  let plays = 0;
  let pauses = 0;
  const timers = [];
  const navigation = {
    getTimeViewRange: () => [0, 100],
    setTimeRight: () => scrolls++,
  };
  const context = {
    SV: {
      create: () => {
        let value;
        let callback;
        return {
          getValue: () => value,
          setValue: (next) => {
            value = next;
            callback?.();
          },
          setValueChangeCallback: (next) => { callback = next; },
        };
      },
      getProject: () => ({
        getNumTracks: () => 0,
        getTimeAxis: () => ({ getBlickFromSeconds: (seconds) => seconds }),
      }),
      getMainEditor: () => ({ getNavigation: () => navigation }),
      getPlayback: () => ({
        getStatus: () => status,
        getPlayhead: () => 10,
        play: () => { plays++; status = "playing"; },
        pause: () => { pauses++; status = "stopped"; },
      }),
      refreshSidePanel: () => {},
      setTimeout: (delay, callback) => timers.push({ at: now + delay, callback }),
    },
  };
  runInNewContext(script, context);
  return {
    widget(text) {
      const widget = context.getSidePanelSectionState().rows
        .flatMap((row) => row.columns).find((widget) => widget?.text === text);
      assert.ok(widget, `Missing widget: ${text}`);
      return widget.value;
    },
    advance(milliseconds) {
      const end = now + milliseconds;
      let callbacks = 0;
      while (true) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > end) break;
        assert.ok(callbacks++ < 10000, "Timer loop did not settle");
        const timer = timers.shift();
        now = timer.at;
        timer.callback();
      }
      now = end;
    },
    setStatus(next) { status = next; },
    get scrolls() { return scrolls; },
    get plays() { return plays; },
    get pauses() { return pauses; },
  };
}

test("manual mode remains the default and Play/Pause controls playback", () => {
  const app = setup("playing");
  app.advance(200);
  assert.equal(app.scrolls, 0);
  app.widget("Play").setValue(true);
  app.advance(30);
  assert.equal(app.plays, 1);
  assert.ok(app.scrolls > 0);
  app.widget("Pause").setValue(true);
  const count = app.scrolls;
  app.advance(200);
  assert.equal(app.pauses, 1);
  assert.equal(app.scrolls, count);
});

test("automatic mode follows external play, pause, resume, and loop without controlling audio", () => {
  const app = setup();
  app.widget("Follow Playback State").setValue(true);
  app.advance(200);
  assert.equal(app.scrolls, 0);
  for (const status of ["playing", "looping", "playing"]) {
    const before = app.scrolls;
    app.setStatus(status);
    app.advance(150);
    app.widget("Pause");
    const count = app.scrolls;
    assert.ok(count > before);
    app.setStatus("stopped");
    app.advance(150);
    app.widget("Play");
    assert.equal(app.scrolls, count);
  }
  assert.equal(app.plays, 0);
  assert.equal(app.pauses, 0);
});

test("enabling mid-play follows immediately and disabling leaves audio untouched", () => {
  const app = setup("looping");
  app.widget("Follow Playback State").setValue(true);
  app.widget("Pause");
  app.advance(30);
  assert.ok(app.scrolls > 0);
  app.widget("Follow Playback State").setValue(false);
  const count = app.scrolls;
  app.advance(200);
  assert.equal(app.scrolls, count);
  assert.equal(app.plays, 0);
  assert.equal(app.pauses, 0);
  app.widget("Play").setValue(true);
  app.advance(30);
  assert.ok(app.scrolls > count);
});

test("Play/Pause in automatic mode uses the latest host state before the next poll", () => {
  const app = setup();
  app.widget("Follow Playback State").setValue(true);
  const playPause = app.widget("Play");
  app.setStatus("looping");
  playPause.setValue(true);
  assert.equal(app.pauses, 1);
  assert.equal(app.plays, 0);
  playPause.setValue(false);
  app.advance(150);
  assert.equal(app.plays, 1);
  assert.ok(app.scrolls > 0);
});

test("rapid manual toggles do not multiply the follow timer", () => {
  const baseline = setup();
  baseline.widget("Play").setValue(true);
  baseline.advance(150);
  const app = setup();
  for (let i = 0; i < 10; i++) {
    app.widget("Play").setValue(true);
    app.widget("Pause").setValue(true);
  }
  app.widget("Play").setValue(true);
  const before = app.scrolls;
  app.advance(150);
  assert.ok(app.scrolls - before <= baseline.scrolls);
});

test("rapid checkbox toggles keep one follow timer", () => {
  const baseline = setup("playing");
  baseline.widget("Follow Playback State").setValue(true);
  baseline.advance(150);
  const app = setup("playing");
  const follow = app.widget("Follow Playback State");
  for (let i = 0; i < 10; i++) {
    follow.setValue(true);
    follow.setValue(false);
  }
  follow.setValue(true);
  const before = app.scrolls;
  app.advance(150);
  assert.ok(app.scrolls - before <= baseline.scrolls);
});
