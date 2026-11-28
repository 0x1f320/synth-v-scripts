import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../dist/note-management.js", import.meta.url), "utf8");

// 120 BPM: one quarter (705600000 blicks) is 0.5 s.
const QUARTER = 705600000;
const BLICKS_PER_SECOND = QUARTER * 2;
const ms = (value) => Math.round((value / 1000) * BLICKS_PER_SECOND);

function pitchPoint() {
  let position = 0;
  let pitch = 0;
  return {
    kind: "point",
    getPosition: () => position,
    setPosition: (next) => { position = next; },
    getPitch: () => pitch,
    setPitch: (next) => { pitch = next; },
  };
}

function pitchCurve() {
  let position = 0;
  let pitch = 0;
  let points = [];
  return {
    kind: "curve",
    getPosition: () => position,
    setPosition: (next) => { position = next; },
    getPitch: () => pitch,
    setPitch: (next) => { pitch = next; },
    getPoints: () => points.map((point) => [point[0], point[1]]),
    setPoints: (next) => { points = next.map((point) => [point[0], point[1]]); },
  };
}

function setup({ notes = [], controls = [], timeOffset = 0 } = {}) {
  const messages = [];
  let undoRecords = 0;
  const list = [];
  const group = {
    getNumPitchControls: () => list.length,
    getPitchControl: (index) => list[index],
    addPitchControl: (control) => {
      control.getIndexInParent = () => list.indexOf(control);
      list.push(control);
      list.sort((a, b) => a.getPosition() - b.getPosition());
      return list.indexOf(control);
    },
    removePitchControl: (index) => { list.splice(index, 1); },
  };
  for (const control of controls) group.addPitchControl(control);
  const selected = notes.map(([onset, end]) => ({ getOnset: () => onset, getEnd: () => end }));

  const context = {
    SV: {
      create: (type) => {
        if (type === "PitchControlPoint") return pitchPoint();
        if (type === "PitchControlCurve") return pitchCurve();
        let value;
        let enabled = true;
        let callback;
        return {
          getValue: () => value,
          setValue: (next) => { value = next; callback?.(next); },
          getEnabled: () => enabled,
          setEnabled: (next) => { enabled = next; },
          setValueChangeCallback: (next) => { callback = next; },
        };
      },
      getMainEditor: () => ({
        getSelection: () => ({
          getSelectedNotes: () => selected,
          hasSelectedNotes: () => selected.length > 0,
          registerSelectionCallback: () => {},
          registerClearCallback: () => {},
        }),
        getCurrentGroup: () => ({ getTarget: () => group, getTimeOffset: () => timeOffset }),
      }),
      getProject: () => ({
        newUndoRecord: () => { undoRecords++; },
        getTimeAxis: () => ({
          getSecondsFromBlick: (blick) => blick / BLICKS_PER_SECOND,
          getBlickFromSeconds: (seconds) => seconds * BLICKS_PER_SECOND,
        }),
      }),
      showMessageBoxAsync: (_title, message, callback) => { messages.push(message); callback(); },
      refreshSidePanel: () => {},
    },
  };
  runInNewContext(script, context);

  const widget = (text) => {
    const found = context
      .getSidePanelSectionState()
      .rows.flatMap((row) => row.columns ?? [])
      .find((column) => column.text === text);
    assert.ok(found, `Missing widget: ${text}`);
    return found.value;
  };
  return {
    state: () => context.getSidePanelSectionState(),
    widget,
    convert: () => widget("Convert").setValue(true),
    points: () => list.filter((c) => c.kind === "point").map((c) => [c.getPosition(), c.getPitch()]),
    curves: () =>
      list
        .filter((c) => c.kind === "curve")
        .map((c) => c.getPoints().map(([t, v]) => [c.getPosition() + t, c.getPitch() + v])),
    messages,
    get undoRecords() { return undoRecords; },
  };
}

function curve(position, pitch, points) {
  const c = pitchCurve();
  c.setPosition(position);
  c.setPitch(pitch);
  c.setPoints(points);
  return c;
}

function assertSamples(actual, expected) {
  assert.equal(actual.length, expected.length, JSON.stringify(actual));
  actual.forEach(([time, pitch], i) => {
    assert.ok(Math.abs(time - expected[i][0]) <= 1, `time ${i}: ${time} != ${expected[i][0]}`);
    assert.ok(Math.abs(pitch - expected[i][1]) < 1e-9, `pitch ${i}: ${pitch} != ${expected[i][1]}`);
  });
}

test("the feature dropdown shows Pitch Line to Points with its controls", () => {
  const app = setup();
  const [, combo] = app.state().rows;
  assert.deepEqual([...combo.columns[0].choices], ["Pitch Line to Points"]);
  assert.equal(app.widget("Interval").getValue(), 50);
  assert.equal(app.widget("Convert").getEnabled(), false);
});

test("a pitch line inside the selection becomes points every interval, keeping its shape", () => {
  // Line from 60 at 0 ms to 62 at 200 ms, anchored at 100 ms / pitch 61.
  const line = curve(ms(100), 61, [[-ms(100), -1], [ms(100), 1]]);
  const app = setup({ notes: [[0, ms(1000)]], controls: [line] });
  app.widget("Interval").setValue(50);
  app.convert();

  assert.equal(app.undoRecords, 1);
  assert.deepEqual(app.curves(), []);
  assertSamples(app.points(), [
    [0, 60],
    [ms(50), 60.5],
    [ms(100), 61],
    [ms(150), 61.5],
    [ms(200), 62],
  ]);
});

test("only the part under the selected notes is converted; the rest stays a pitch line", () => {
  const line = curve(0, 60, [[0, 0], [ms(300), 3]]);
  const app = setup({ notes: [[ms(100), ms(200)]], controls: [line] });
  app.widget("Interval").setValue(40);
  app.convert();

  assertSamples(app.points(), [
    [ms(100), 61],
    [ms(140), 61.4],
    [ms(180), 61.8],
    [ms(200), 62],
  ]);
  const remainders = app.curves();
  assert.equal(remainders.length, 2);
  assertSamples(remainders[0], [[0, 60], [ms(100), 61]]);
  assertSamples(remainders[1], [[ms(200), 62], [ms(300), 63]]);
});

test("points stay in group-relative time when the group has a time offset", () => {
  const offset = ms(1000);
  const line = curve(0, 60, [[0, 0], [ms(100), 1]]);
  const app = setup({ notes: [[0, ms(100)]], controls: [line], timeOffset: offset });
  app.widget("Interval").setValue(25);
  app.convert();
  assert.deepEqual(app.points().map(([time]) => time), [0, ms(25), ms(50), ms(75), ms(100)]);
});

test("existing pitch points and lines outside the selection are left alone", () => {
  const point = pitchPoint();
  point.setPosition(ms(50));
  point.setPitch(64);
  const outside = curve(ms(500), 60, [[0, 0], [ms(100), 1]]);
  const app = setup({ notes: [[0, ms(200)]], controls: [point, outside] });
  app.convert();

  assert.equal(app.undoRecords, 0);
  assert.deepEqual(app.messages, ["No manual pitch lines overlap the selected notes."]);
  assert.deepEqual(app.points(), [[ms(50), 64]]);
  assert.equal(app.curves().length, 1);
});

test("converting without selected notes shows a message and edits nothing", () => {
  const line = curve(0, 60, [[0, 0], [ms(100), 1]]);
  const app = setup({ controls: [line] });
  app.convert();
  assert.deepEqual(app.messages, ["Select one or more notes first."]);
  assert.equal(app.undoRecords, 0);
  assert.equal(app.curves().length, 1);
});
