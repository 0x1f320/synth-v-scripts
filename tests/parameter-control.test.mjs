import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/parameter-control.ts"],
  bundle: true,
  format: "iife",
  write: false,
});

function setup(initialFiles = new Map()) {
  let groupId = "group-a";
  let trackId = "track-a";
  let modes = { Power: {}, Mellow: {} };
  let projectPath = "/project.svp";
  let dialog;
  const timers = [];
  const files = initialFiles;
  const project = {
    tracks: [
      { mainRef: { groupID: "track-a", database: { name: "Kasane Teto AI 2" } },
        groups: ["group-a", "group-b"].map((groupID) => ({ groupID, blickOffset: 0, database: { name: "" } })) },
      { mainRef: { groupID: "track-b", database: { name: "Kasane Teto AI 2" } },
        groups: [{ groupID: "group-c", blickOffset: 0, database: { name: "" } }] },
      { mainRef: { groupID: "track-other", database: { name: "Other Voice" } },
        groups: [{ groupID: "group-d", blickOffset: 0, database: { name: "" } },
          { groupID: "group-override", blickOffset: 0, database: { name: "Kasane Teto AI 2" } }] },
    ],
  };
  files.set("/project.svp", JSON.stringify(project) + "\0");
  const context = {
    // The native Lua host does not provide JavaScript's JSON global.
    JSON: undefined,
    os: { getenv: () => "/test" },
    io: {
      open(path, mode) {
        if (mode === "r" && !files.has(path)) return undefined;
        return {
          read: () => files.get(path),
          write: (text) => files.set(path, text),
          close() {},
        };
      },
    },
    SV: {
      print() {},
      getProject: () => ({ getFileName: () => projectPath }),
      create: () => {
        let value;
        let callback;
        return {
          getValue: () => value,
          setValue: (next) => { value = next; callback?.(next); },
          setEnabled(next) { this.enabled = next; },
          setValueChangeCallback: (next) => { callback = next; },
        };
      },
      getMainEditor: () => ({
        getCurrentGroup: () => ({
          getTarget: () => ({ getUUID: () => groupId }),
          getVoice: () => ({ vocalModeParams: modes }),
          getTimeOffset: () => 0,
          isMain: () => groupId === trackId,
          getParent: () => ({ getGroupReference: () => ({ getTarget: () => ({ getUUID: () => trackId }) }) }),
        }),
        getSelection: () => ({
          getSelectedGroups: () => [],
          getSelectedNotes: () => [],
          registerSelectionCallback() {},
          registerClearCallback() {},
        }),
      }),
      refreshSidePanel() {},
      setTimeout: (delay, callback) => timers.push({ delay, callback }),
      showCustomDialogAsync: (form, callback) => { dialog = { form, callback }; },
    },
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  function widgets() {
    return context.getSidePanelSectionState().rows.flatMap((row) => row.columns ?? [row]);
  }
  return {
    files,
    widgets,
    switchProject(path, data) {
      projectPath = path;
      if (data) files.set(path, JSON.stringify(data));
      const index = timers.findIndex((timer) => timer.delay === 500);
      timers.splice(index, 1)[0].callback();
    },
    target: () => widgets().find((widget) => widget.type === "ComboBox"),
    beginPreset() {
      widgets().find((widget) => widget.text === "Define Preset...").value.setValue(true);
      const index = timers.findIndex((timer) => timer.delay === 16);
      timers.splice(index, 1)[0].callback();
    },
    finishPreset() {
      const amount = dialog.form.widgets.find((widget) => widget.type === "Slider");
      dialog.callback({ status: "Ok", answers: { name: "Shared voice preset", [amount.name]: 10 } });
    },
    definePreset() { this.beginPreset(); this.finishPreset(); },
    switchGroup(id, nextModes = modes, track = trackId) { groupId = id; modes = nextModes; trackId = track; },
    saveVoice(name) {
      project.tracks[0].mainRef.database.name = name;
      files.set("/project.svp", JSON.stringify(project));
      const index = timers.findIndex((timer) => timer.delay === 500);
      timers.splice(index, 1)[0].callback();
    },
  };
}

test("a saved preset stays visible when another group uses the same voice", () => {
  const app = setup();
  app.definePreset();
  assert.ok(app.target().choices.includes("Preset: Shared voice preset"));
  app.switchGroup("group-b");
  assert.ok(app.target().choices.includes("Preset: Shared voice preset"));
});

test("unidentified groups never read or write group or unknown preset stores", () => {
  const app = setup();
  app.definePreset();
  const before = new Map(app.files);
  app.switchGroup("new-unsaved-group");
  assert.equal(app.target().choices.some((label) => label.startsWith("Preset:")), false);
  assert.equal(app.widgets().find((w) => w.text === "Define Preset...").value.enabled, false);
  app.switchGroup("another-unsaved-group");
  app.target();
  assert.equal([...app.files.keys()].some((path) => /\.parameter-control\.(group-|unknown-)/.test(path)), false);
  for (const [path, text] of before) {
    if (path.endsWith(".json")) assert.deepEqual(JSON.parse(app.files.get(path)).presets, JSON.parse(text).presets);
  }
});

test("the same bank shares presets across SVPs, with no fallback for an unsaved project", () => {
  const app = setup();
  app.definePreset();
  app.switchGroup("other-project-group", {}, "other-project-track");
  app.switchProject("/other.svp", { tracks: [{
    mainRef: { groupID: "other-project-track", database: { name: "Kasane Teto AI 2" } },
    groups: [{ groupID: "other-project-group", database: { name: "" } }],
  }] });
  assert.ok(app.target().choices.includes("Preset: Shared voice preset"));
  app.switchProject("");
  assert.equal(app.target().choices.some((label) => label.startsWith("Preset:")), false);
  assert.equal(app.widgets().find((w) => w.text === "Define Preset...").value.enabled, false);
  assert.equal([...app.files.keys()].some((path) => /\.parameter-control\.(group-|unknown-)/.test(path)), false);
  app.switchProject("/other.svp");
  assert.ok(app.target().choices.includes("Preset: Shared voice preset"));
});

test("a dialog opened for one bank cannot write into another bank after switching", () => {
  const app = setup();
  app.beginPreset();
  app.switchGroup("group-d", {}, "track-other");
  app.target();
  app.finishPreset();
  assert.equal(app.target().choices.some((label) => label.startsWith("Preset:")), false);
});

test("a new preset cannot overwrite a legacy preset imported while its dialog is open", () => {
  const app = setup();
  app.beginPreset();
  const path = "/test/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts/.parameter-control.group-group-b-242536865-1054452673.json";
  app.files.set(path, JSON.stringify({ version: 1, presets: [{
    id: "preset-1", name: "Legacy precious preset",
    entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
  }] }));
  app.switchGroup("group-b");
  app.switchProject("/another.svp", { tracks: [{
    mainRef: { groupID: "track-a", database: { name: "Kasane Teto AI 2" } },
    groups: [{ groupID: "group-b", database: { name: "" } }],
  }] });
  assert.ok(app.target().choices.includes("Preset: Legacy precious preset"));
  app.finishPreset();
  assert.ok(app.target().choices.includes("Preset: Legacy precious preset"));
  assert.ok(app.target().choices.includes("Preset: Shared voice preset"));
  const stores = [...app.files].filter(([path]) => path.includes(".voicebank-"));
  assert.equal(new Set(JSON.parse(stores[0][1]).presets.map((p) => p.id)).size, 2);
});

test("presets follow database.name across tracks, overrides, and saved voice changes", () => {
  const app = setup();
  app.definePreset();
  for (const [group, track, visible] of [
    ["group-c", "track-b", true],
    ["group-d", "track-other", false],
    ["group-override", "track-other", true],
    ["group-a", "track-a", true],
  ]) {
    app.switchGroup(group, {}, track);
    assert.equal(app.target().choices.includes("Preset: Shared voice preset"), visible);
  }
  app.saveVoice("Other Voice");
  assert.equal(app.target().choices.includes("Preset: Shared voice preset"), false);
  app.saveVoice("Kasane Teto AI 2");
  assert.equal(app.target().choices.includes("Preset: Shared voice preset"), true);
});

test("changing the detected vocal modes preserves the selected preset", () => {
  const app = setup();
  app.definePreset();
  const before = app.target();
  assert.equal(before.choices[before.value.getValue()], "Preset: Shared voice preset");
  app.switchGroup("group-a", { Power: {}, Mellow: {}, Rock: {}, Low: {} });
  const after = app.target();
  assert.equal(after.choices[after.value.getValue()], "Preset: Shared voice preset");
});

test("legacy group presets migrate without ID collisions or reappearing after deletion", () => {
  const directory = "/test/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts/";
  const files = new Map([
    [directory + ".parameter-control.group-group-a-242536864-3111974527.json", JSON.stringify({
      version: 1, presets: [{ id: "preset-1", name: "Shout", entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }] }],
    })],
    [directory + ".parameter-control.group-group-b-242536865-1054452673.json", JSON.stringify({
      version: 1, presets: [{ id: "preset-1", name: "Falsetto", entries: [{ label: "Gender", typeName: "gender", amount: 0.2 }] }],
    })],
    [directory + ".parameter-control.group-group-d-242536867-1234376261.json", JSON.stringify({
      version: 1, presets: [{ id: "preset-1", name: "Other voice only", entries: [{ label: "Tension", typeName: "tension", amount: 0.8 }] }],
    })],
  ]);
  const originals = new Map(files);
  const app = setup(files);
  assert.deepEqual(Array.from(app.target().choices.filter((label) => label.startsWith("Preset:"))), ["Preset: Shout", "Preset: Falsetto"]);
  const [path, text] = [...files].find(([path]) => path.includes(".voicebank-"));
  const saved = JSON.parse(text);
  assert.equal(new Set(saved.presets.map((preset) => preset.id)).size, 2);
  for (const [path, text] of originals) assert.equal(files.get(path), text);
  saved.presets = [];
  files.set(path, JSON.stringify(saved));
  const restarted = setup(files);
  assert.equal(restarted.target().choices.some((label) => label.startsWith("Preset:")), false);
});
