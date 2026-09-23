import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Execute the shipped ES5 bundle; only the external SynthV host is simulated.
const source = existsSync("dist/growl.js") ? readFileSync("dist/growl.js", "utf8") : "";

function host() {
  let notes = [];
  let undoCount = 0;
  const messages = [];
  const callbacks = {};
  const selection = {
    getSelectedNotes: () => notes,
    registerSelectionCallback: (fn) => {
      callbacks.select = fn;
    },
    registerClearCallback: (fn) => {
      callbacks.clear = fn;
    },
  };
  const context = vm.createContext({
    SV: {
      create: () => ({
        value: undefined,
        enabled: true,
        getValue() {
          return this.value;
        },
        setValue(value) {
          this.value = value;
        },
        setEnabled(value) {
          this.enabled = value;
        },
        setValueChangeCallback(fn) {
          this.callback = fn;
        },
      }),
      T: (text) => text,
      getMainEditor: () => ({ getSelection: () => selection }),
      getProject: () => ({
        newUndoRecord: () => {
          undoCount++;
        },
      }),
      refreshSidePanel: () => {},
      showMessageBox: (...args) => messages.push(args),
    },
  });
  vm.runInContext(source, context);
  assert.equal(
    typeof context.getSidePanelSectionState,
    "function",
    "Growl must expose a persistent sidebar",
  );
  function widgets() {
    return context.getSidePanelSectionState().rows.flatMap((r) => r.columns ?? []);
  }
  return {
    context,
    messages,
    undoCount: () => undoCount,
    select(value) {
      notes = value;
      callbacks.select?.("note", true);
    },
    set(index, value) {
      const slider = widgets().filter((w) => w.type === "Slider")[index].value;
      slider.setValue(value);
      slider.callback?.(value);
    },
    apply() {
      widgets()
        .find((w) => w.type === "Button")
        .value.callback();
    },
    enabled: () => widgets().find((w) => w.type === "Button").value.enabled,
  };
}

function group() {
  const points = new Map([
    [500, 33],
    [6000, 44],
  ]);
  return {
    points,
    getParameter(name) {
      assert.equal(name, "pitchDelta");
      return {
        remove(from, to) {
          for (const p of points.keys()) if (p >= from && p <= to) points.delete(p);
        },
        add(time, value) {
          points.set(time, value);
        },
      };
    },
  };
}

function note(parent, onset = 1000, duration = 4000) {
  return { getOnset: () => onset, getDuration: () => duration, getParent: () => parent };
}

test("sidebar registration and sliders do not edit the project", () => {
  const h = host();
  assert.equal(h.context.getClientInfo().type, "SidePanelSection");
  h.set(2, 120);
  assert.equal(h.undoCount(), 0);
});

test("empty selection and invalid ranges cannot mutate pitch", () => {
  const h = host();
  assert.equal(h.enabled(), false);
  h.apply();
  const g = group();
  h.select([note(g)]);
  h.set(0, 100);
  h.set(1, 100);
  h.apply();
  h.set(0, Number.NaN);
  h.apply();
  assert.equal(h.undoCount(), 0);
  assert.deepEqual(
    [...g.points],
    [
      [500, 33],
      [6000, 44],
    ],
  );
});

test("apply replaces the chosen percentage range with alternating pitch in one undo", () => {
  const h = host();
  const g = group();
  g.points.set(3000, 200);
  h.select([note(g)]);
  h.set(0, 25);
  h.set(1, 75);
  h.set(2, 90);
  h.set(3, 4);
  h.apply();
  assert.equal(h.undoCount(), 1);
  assert.deepEqual(
    [...g.points].sort((a, b) => a[0] - b[0]),
    [
      [500, 33],
      [1900, 0],
      [2000, 90],
      [2500, -90],
      [3000, 90],
      [3500, -90],
      [4000, 90],
      [4100, 0],
      [6000, 44],
    ],
  );
  assert.equal(h.messages.length, 0, "successful application must not open a modal");
});

test("each selected note edits its own group and repeat apply replaces rather than accumulates", () => {
  const h = host();
  const a = group();
  const b = group();
  h.select([note(a), note(b, 2000, 2000)]);
  h.set(3, 2);
  h.apply();
  assert.equal(a.points.get(1000), 90);
  assert.equal(b.points.get(2000), 90);
  h.set(2, 60);
  h.apply();
  assert.equal(a.points.get(1000), 60);
  assert.equal(b.points.get(2000), 60);
  assert.equal(h.undoCount(), 2);
});

test("zero length notes do not enter a sampling loop or create an undo entry", () => {
  const h = host();
  const g = group();
  h.select([note(g, 1000, 0)]);
  h.apply();
  assert.equal(h.undoCount(), 0);
  assert.deepEqual(
    [...g.points],
    [
      [500, 33],
      [6000, 44],
    ],
  );
});
