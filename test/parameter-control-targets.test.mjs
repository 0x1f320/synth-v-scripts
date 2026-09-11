import assert from "node:assert/strict";
import test from "node:test";

import * as parameterTargetModule from "../src/common/parameter-control-targets.ts";
import {
  buildTargetChoices,
  composeEasedAutomationValue,
  customDialogSliderFormat,
  DEFINE_PRESET_LABEL,
  EXTRACT_PRESET_LABEL,
  easedAutomationIntersectionTimes,
  easingMultiplierAt,
  extractedPresetEntriesFromSamples,
  extractPresetTargetChoices,
  normalizeDialogStatus,
  parseParameterControlStore,
  parseParameterPresetStore,
  presetAmountWidgetName,
  presetDialogTargetChoices,
  presetEntriesFromSliderAnswers,
  replacePresetEntriesFromSliderAnswers,
  resolveEasingEnvelope,
  resolveEasingEnvelopes,
  resolveEasingPlacement,
  resolvePresetDeltas,
  resolveTargetChange,
  resolveTargetSelection,
  restoreTargetValue,
  saveTargetValue,
  serializeParameterControlStore,
  serializeParameterPresetStore,
  targetValueKey,
  upsertPresetEntry,
} from "../src/common/parameter-control-targets.ts";

function widgetValue(value = 0) {
  return {
    getValue: () => value,
    setValue: () => undefined,
    getEnabled: () => true,
    setEnabled: () => undefined,
    setValueChangeCallback: () => undefined,
  };
}

function buttonTexts(rows) {
  return rows.flatMap((row) =>
    (row.columns ?? []).filter((column) => column.type === "Button").map((column) => column.text),
  );
}

function buttonRows(rows) {
  return rows.filter((row) => (row.columns ?? []).some((column) => column.type === "Button"));
}

test("buildTargetChoices keeps Define Preset out of the target menu", () => {
  const choices = buildTargetChoices(
    [
      { label: "Pitch Deviation", typeName: "pitchDelta" },
      { label: "Vocal Mode: Joyful", typeName: "vocalMode_Joyful" },
    ],
    [
      {
        id: "preset-1",
        name: "Preset 1",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
  );

  assert.deepEqual(
    choices.map((choice) => choice.label),
    ["Pitch Deviation", "Vocal Mode: Joyful", "Preset: Preset 1"],
  );
});

test("buildParameterControlRows exposes preset definition as a button", () => {
  const buildRows = parameterTargetModule.buildParameterControlRows;

  assert.equal(typeof buildRows, "function");

  const rows = buildRows({
    targetLabels: ["Pitch Deviation"],
    parameterValue: widgetValue(),
    deltaValue: widgetValue(),
    deltaFormat: "%1.0f cents",
    deltaLimit: 1200,
    deltaStep: 5,
    easingValue: widgetValue(),
    easingLeftValue: widgetValue(true),
    easingRightValue: widgetValue(true),
    easingPlacementValue: widgetValue(),
    definePresetLabel: DEFINE_PRESET_LABEL,
    definePresetValue: widgetValue(),
    extractPresetValue: widgetValue(),
    deletePresetValue: widgetValue(),
    applyValue: widgetValue(),
    invertValue: widgetValue(),
  });

  assert.deepEqual(buttonTexts(rows), [
    "Apply",
    "Invert",
    DEFINE_PRESET_LABEL,
    EXTRACT_PRESET_LABEL,
    "Delete Preset",
  ]);
});

test("buildParameterControlRows puts Invert next to Apply", () => {
  const rows = parameterTargetModule.buildParameterControlRows({
    targetLabels: ["Pitch Deviation"],
    parameterValue: widgetValue(),
    deltaValue: widgetValue(),
    deltaFormat: "%1.0f cents",
    deltaLimit: 1200,
    deltaStep: 5,
    easingValue: widgetValue(),
    easingLeftValue: widgetValue(true),
    easingRightValue: widgetValue(true),
    easingPlacementValue: widgetValue(),
    definePresetLabel: "Edit Preset...",
    definePresetValue: widgetValue(),
    extractPresetValue: widgetValue(),
    deletePresetValue: widgetValue(),
    applyValue: widgetValue(),
    invertValue: widgetValue(),
  });

  const actions = buttonRows(rows);

  assert.equal(actions.length, 3);
  assert.deepEqual(
    actions.map((row) => row.columns.map((column) => ({ text: column.text, width: column.width }))),
    [
      [
        { text: "Apply", width: 1 },
        { text: "Invert", width: 1 },
      ],
      [
        { text: "Edit Preset...", width: 1 },
        { text: EXTRACT_PRESET_LABEL, width: 1 },
      ],
      [{ text: "Delete Preset", width: 1 }],
    ],
  );
});

test("buildParameterControlRows puts Left and Right toggles below the easing slider", () => {
  const rows = parameterTargetModule.buildParameterControlRows({
    targetLabels: ["Pitch Deviation"],
    parameterValue: widgetValue(),
    deltaValue: widgetValue(),
    deltaFormat: "%1.0f cents",
    deltaLimit: 1200,
    deltaStep: 5,
    easingValue: widgetValue(),
    easingLeftValue: widgetValue(true),
    easingRightValue: widgetValue(true),
    easingPlacementValue: widgetValue(),
    definePresetLabel: DEFINE_PRESET_LABEL,
    definePresetValue: widgetValue(),
    extractPresetValue: widgetValue(),
    deletePresetValue: widgetValue(),
    applyValue: widgetValue(),
    invertValue: widgetValue(),
  });

  const easingSliderIndex = rows.findIndex((row) =>
    (row.columns ?? []).some((column) => column.type === "Slider" && column.text === "Amount"),
  );

  assert.deepEqual(
    rows[easingSliderIndex + 1].columns.map((column) => ({
      type: column.type,
      text: column.text,
      width: column.width,
    })),
    [
      { type: "CheckBox", text: "Left", width: 1 },
      { type: "CheckBox", text: "Right", width: 1 },
    ],
  );
});

test("presetActionState switches define button into edit mode for selected presets", () => {
  const presetActionState = parameterTargetModule.presetActionState;

  assert.equal(typeof presetActionState, "function");
  assert.deepEqual(presetActionState({ label: "Pitch Deviation", typeName: "pitchDelta" }), {
    definePresetLabel: DEFINE_PRESET_LABEL,
    deletePresetEnabled: false,
  });
  assert.deepEqual(
    presetActionState({ label: "Preset: Verse", kind: "preset", presetId: "preset-1" }),
    {
      definePresetLabel: "Edit Preset...",
      deletePresetEnabled: true,
    },
  );
});

test("collectUsableVocalModeNames prefers voicebank vocal mode lists over edited params", () => {
  const collectNames = parameterTargetModule.collectUsableVocalModeNames;

  assert.equal(typeof collectNames, "function");

  const names = collectNames({
    voiceData: {
      usingVoiceInfoVocalModes: ["Power", "Cute"],
      vocalModes: ["Power", "Cute", "UnrelatedGlobalMode"],
      vocalModeParams: {
        ForcedProbeResult: {},
      },
    },
  });

  assert.deepEqual(names, ["Cute", "Power"]);
});

test("collectUsableVocalModeNames prefers selected group vocal modes over edited params", () => {
  const collectNames = parameterTargetModule.collectUsableVocalModeNames;

  assert.equal(typeof collectNames, "function");

  const names = collectNames({
    groupData: {
      vocalModes: {
        Low: {},
        Power: {},
      },
    },
    voiceData: {
      vocalModeParams: {
        Adult: {},
        Aggressive: {},
        Joyful: {},
      },
    },
  });

  assert.deepEqual(names, ["Low", "Power"]);
});

test("collectUsableVocalModeNames falls back to current voice params when no list is exposed", () => {
  const collectNames = parameterTargetModule.collectUsableVocalModeNames;

  assert.equal(typeof collectNames, "function");

  const names = collectNames({
    voiceData: {
      vocalModeParams: {
        Adult: {},
        Aggressive: {},
        Joyful: {},
      },
    },
  });

  assert.deepEqual(names, ["Adult", "Aggressive", "Joyful"]);
});

test("collectUsableVocalModeNames ignores nested global vocal mode params", () => {
  const collectNames = parameterTargetModule.collectUsableVocalModeNames;

  assert.equal(typeof collectNames, "function");

  const names = collectNames({
    referenceData: {
      nestedProjectLikeData: {
        vocalModeParams: {
          Adult: {},
          Aggressive: {},
          Joyful: {},
        },
      },
    },
  });

  assert.deepEqual(names, []);
});

test("selectVocalModeReference prefers the selected group reference over the current group", () => {
  const selectReference = parameterTargetModule.selectVocalModeReference;

  assert.equal(typeof selectReference, "function");

  const currentReference = { id: "current" };
  const selectedReference = { id: "selected" };

  assert.equal(selectReference(currentReference, [selectedReference]), selectedReference);
});

test("selectVocalModeReference falls back to the current group when no group is selected", () => {
  const selectReference = parameterTargetModule.selectVocalModeReference;

  assert.equal(typeof selectReference, "function");

  const currentReference = { id: "current" };

  assert.equal(selectReference(currentReference, []), currentReference);
});

test("resolveTargetSelection keeps preset choices selectable", () => {
  const choices = buildTargetChoices(
    [{ label: "Pitch Deviation", typeName: "pitchDelta" }],
    [
      {
        id: "preset-1",
        name: "Preset 1",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
  );

  const selection = resolveTargetSelection({
    choices,
    nextIndex: 1,
    previousIndex: 0,
  });

  assert.deepEqual(selection, {
    action: "none",
    index: 1,
  });
});

test("resolveTargetSelection ignores Define Preset labels because presets are defined by button", () => {
  const choices = buildTargetChoices([{ label: "Pitch Deviation", typeName: "pitchDelta" }]);

  const selection = resolveTargetSelection({
    choices,
    nextIndex: DEFINE_PRESET_LABEL,
    previousIndex: 0,
  });

  assert.deepEqual(selection, {
    action: "none",
    index: 0,
  });
});

test("resolveTargetSelection accepts SynthV ComboBox label values for real targets", () => {
  const choices = buildTargetChoices([
    { label: "Pitch Deviation", typeName: "pitchDelta" },
    { label: "Tension", typeName: "tension" },
  ]);

  const selection = resolveTargetSelection({
    choices,
    nextIndex: "Pitch Deviation",
    previousIndex: 1,
  });

  assert.deepEqual(selection, {
    action: "none",
    index: 0,
  });
});

test("resolveTargetChange prefers callback values over stale WidgetValue state for real targets", () => {
  const choices = buildTargetChoices([
    { label: "Pitch Deviation", typeName: "pitchDelta" },
    { label: "Tension", typeName: "tension" },
  ]);

  const selection = resolveTargetChange({
    choices,
    callbackValue: "Pitch Deviation",
    currentValue: 1,
    previousIndex: 1,
  });

  assert.deepEqual(selection, {
    action: "none",
    index: 0,
  });
});

test("saveTargetValue keeps separate slider values per parameter target", () => {
  const choices = buildTargetChoices([
    { label: "Pitch Deviation", typeName: "pitchDelta" },
    { label: "Tension", typeName: "tension" },
  ]);
  const values = {};

  saveTargetValue(values, choices[0], 120);
  saveTargetValue(values, choices[1], -0.5);

  assert.equal(restoreTargetValue(values, choices[0], 0), 120);
  assert.equal(restoreTargetValue(values, choices[1], 0), -0.5);
});

test("saveTargetValue keeps preset slider values separate from parameter targets", () => {
  const choices = buildTargetChoices(
    [{ label: "Tension", typeName: "tension" }],
    [
      {
        id: "preset-1",
        name: "Preset 1",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
  );
  const values = {};

  saveTargetValue(values, choices[0], 0.25);
  saveTargetValue(values, choices[1], 50);

  assert.equal(restoreTargetValue(values, choices[0], 0), 0.25);
  assert.equal(restoreTargetValue(values, choices[1], 0), 50);
});

test("targetValueKey gives stable keys for parameter and preset targets", () => {
  const choices = buildTargetChoices(
    [{ label: "Tension", typeName: "tension" }],
    [
      {
        id: "preset-1",
        name: "Preset 1",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
  );

  assert.equal(targetValueKey(choices[0]), "target:tension");
  assert.equal(targetValueKey(choices[1]), "preset:preset-1");
});

test("upsertPresetEntry replaces an existing target instead of duplicating it", () => {
  const entries = upsertPresetEntry(
    [
      { label: "Tension", typeName: "tension", amount: 0.5 },
      { label: "Gender", typeName: "gender", amount: 0.25 },
    ],
    { label: "Tension", typeName: "tension", amount: 0.75 },
  );

  assert.deepEqual(entries, [
    { label: "Tension", typeName: "tension", amount: 0.75 },
    { label: "Gender", typeName: "gender", amount: 0.25 },
  ]);
});

test("presetEntriesFromSliderAnswers keeps only non-zero slider amounts", () => {
  const entries = presetEntriesFromSliderAnswers(
    [
      { label: "Tension", typeName: "tension", min: -1, max: 1 },
      { label: "Gender", typeName: "gender", min: -1, max: 1 },
      { label: "Vocal Mode: Power", typeName: "vocalMode_Power", min: 0, max: 150 },
    ],
    {
      amount_0: 0.5,
      amount_1: 0,
      amount_2: 80,
    },
  );

  assert.deepEqual(entries, [
    { label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 },
    { label: "Vocal Mode: Power", typeName: "vocalMode_Power", amount: 80, min: 0, max: 150 },
  ]);
});

test("presetAmountWidgetName uses simple identifier-compatible names", () => {
  assert.equal(presetAmountWidgetName(0), "amount_0");
  assert.equal(presetAmountWidgetName(12), "amount_12");
});

test("replacePresetEntriesFromSliderAnswers only replaces entries shown on the current page", () => {
  const entries = replacePresetEntriesFromSliderAnswers(
    [
      { label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 },
      { label: "Gender", typeName: "gender", amount: 0.25, min: -1, max: 1 },
      { label: "Vocal Mode: Power", typeName: "vocalMode_Power", amount: 80, min: -150, max: 150 },
    ],
    [
      { label: "Tension", typeName: "tension", min: -1, max: 1 },
      { label: "Gender", typeName: "gender", min: -1, max: 1 },
    ],
    {
      amount_0: 0,
      amount_1: -0.5,
    },
  );

  assert.deepEqual(entries, [
    { label: "Vocal Mode: Power", typeName: "vocalMode_Power", amount: 80, min: -150, max: 150 },
    { label: "Gender", typeName: "gender", amount: -0.5, min: -1, max: 1 },
  ]);
});

test("presetEntriesFromSliderAnswers preserves negative delta amounts for positive-only parameters", () => {
  const entries = presetEntriesFromSliderAnswers(
    [{ label: "Voicing", typeName: "voicing", min: 0, max: 1 }],
    { amount_0: -0.25 },
  );

  assert.deepEqual(entries, [
    { label: "Voicing", typeName: "voicing", amount: -0.25, min: 0, max: 1 },
  ]);
});

test("extractedPresetEntriesFromSamples keeps active median values and labels their source", () => {
  const entries = extractedPresetEntriesFromSamples([
    {
      label: "Tension",
      typeName: "tension",
      min: -1,
      max: 1,
      defaultValue: 0,
      values: [0.2, 0.8, 0.4],
      source: "graph",
    },
    {
      label: "Gender",
      typeName: "gender",
      min: -1,
      max: 1,
      defaultValue: 0,
      values: [0, 0, 0],
      source: "graph",
    },
    {
      label: "Vocal Mode: Power",
      typeName: "vocalMode_Power",
      min: 0,
      max: 150,
      defaultValue: 0,
      values: [50, 70],
      source: "control",
    },
  ]);

  assert.deepEqual(entries, [
    {
      label: "Tension [Graph]",
      typeName: "tension",
      amount: 0.4,
      min: -1,
      max: 1,
    },
    {
      label: "Vocal Mode: Power [Control]",
      typeName: "vocalMode_Power",
      amount: 60,
      min: 0,
      max: 150,
    },
  ]);
});

test("extractedPresetEntriesFromSamples ignores inactive unknown samples", () => {
  const entries = extractedPresetEntriesFromSamples([
    {
      label: "Tension",
      typeName: "tension",
      min: -1,
      max: 1,
      defaultValue: 0,
      values: [0.5],
      source: "unknown",
    },
  ]);

  assert.deepEqual(entries, []);
});

test("extractPresetTargetChoices skips Rap Intonation but keeps vocal modes", () => {
  const choices = extractPresetTargetChoices([
    { label: "Tension", typeName: "tension" },
    { label: "Rap Intonation", typeName: "rapIntonation" },
    { label: "Vocal Mode: Power", typeName: "vocalMode_Power" },
  ]);

  assert.deepEqual(
    choices.map((choice) => choice.label),
    ["Tension", "Vocal Mode: Power"],
  );
});

test("resolvePresetDeltas scales every preset entry by delta percent", () => {
  const deltas = resolvePresetDeltas(
    {
      id: "preset-1",
      name: "Preset 1",
      entries: [
        { label: "Tension", typeName: "tension", amount: 0.5 },
        { label: "Gender", typeName: "gender", amount: 0.25 },
      ],
    },
    50,
  );

  assert.deepEqual(deltas, [
    { label: "Tension", typeName: "tension", delta: 0.25 },
    { label: "Gender", typeName: "gender", delta: 0.125 },
  ]);
});

test("serializeParameterPresetStore writes versioned preset JSON", () => {
  const json = serializeParameterPresetStore([
    {
      id: "preset-1",
      name: "Ado",
      entries: [
        { label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 },
        { label: "Gender", typeName: "gender", amount: 0.25 },
      ],
    },
  ]);

  assert.deepEqual(JSON.parse(json), {
    version: 1,
    presets: [
      {
        id: "preset-1",
        name: "Ado",
        entries: [
          { label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 },
          { label: "Gender", typeName: "gender", amount: 0.25 },
        ],
      },
    ],
  });
});

test("parseParameterPresetStore loads valid presets and drops malformed entries", () => {
  const presets = parseParameterPresetStore(
    JSON.stringify({
      version: 1,
      presets: [
        {
          id: "preset-1",
          name: "Ado",
          entries: [
            { label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 },
            { label: "Broken", typeName: "gender", amount: "bad" },
          ],
        },
        { id: "bad", name: "No entries", entries: [] },
      ],
    }),
  );

  assert.deepEqual(presets, [
    {
      id: "preset-1",
      name: "Ado",
      entries: [{ label: "Tension", typeName: "tension", amount: 0.5, min: -1, max: 1 }],
    },
  ]);
});

test("parameter control store preserves settings alongside presets", () => {
  const json = serializeParameterControlStore(
    [
      {
        id: "preset-1",
        name: "Ado",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
    {
      selectedTargetKey: "target:tension",
      deltaByTarget: {
        "target:tension": 150,
        "preset:preset-1": -25,
      },
      easingAmount: 40,
      easingPlacement: "inside",
      easingLeft: false,
      easingRight: true,
      controlWrites: {
        tension: [{ start: 100, end: 200 }],
      },
    },
  );

  assert.deepEqual(parseParameterControlStore(json), {
    version: 1,
    presets: [
      {
        id: "preset-1",
        name: "Ado",
        entries: [{ label: "Tension", typeName: "tension", amount: 0.5 }],
      },
    ],
    settings: {
      selectedTargetKey: "target:tension",
      deltaByTarget: {
        "target:tension": 150,
        "preset:preset-1": -25,
      },
      easingAmount: 40,
      easingPlacement: "inside",
      easingLeft: false,
      easingRight: true,
      controlWrites: {
        tension: [{ start: 100, end: 200 }],
      },
    },
  });
});

test("presetDialogTargetChoices includes only non-rap base parameters in preset editor dialogs", () => {
  const choices = presetDialogTargetChoices([
    { label: "Mouth Opening", typeName: "mouthOpening" },
    { label: "Rap Intonation", typeName: "rapIntonation" },
    { label: "Vocal Mode: Power", typeName: "vocalMode_Power" },
    { label: "Vocal Mode: Cute", typeName: "vocalMode_Cute" },
  ]);

  assert.deepEqual(
    choices.map((choice) => choice.label),
    ["Mouth Opening"],
  );
});

test("customDialogSliderFormat strips unit suffixes that are unsafe for SynthV custom dialog sliders", () => {
  assert.equal(customDialogSliderFormat("%1.0f cents"), "%1.0f");
  assert.equal(customDialogSliderFormat("%1.1f dB"), "%1.1f");
  assert.equal(customDialogSliderFormat("%1.0f %%"), "%1.0f");
  assert.equal(customDialogSliderFormat("%1.2f"), "%1.2f");
  assert.equal(customDialogSliderFormat("bad format"), "%1.2f");
});

test("normalizeDialogStatus handles SynthV custom dialog statuses consistently", () => {
  assert.equal(normalizeDialogStatus("Yes"), "yes");
  assert.equal(normalizeDialogStatus("No"), "no");
  assert.equal(normalizeDialogStatus("Cancel"), "cancel");
  assert.equal(normalizeDialogStatus(false), "cancel");
  assert.equal(normalizeDialogStatus(undefined), "cancel");
  assert.equal(normalizeDialogStatus(null), "cancel");
  assert.equal(normalizeDialogStatus(true), "ok");
});

test("resolveEasingEnvelope extends outside easing by note-length percentage", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 50, placement: "outside" },
  );

  assert.deepEqual(envelope, {
    removeStart: 50,
    removeEnd: 250,
    points: [
      [50, 0],
      [100, 1],
      [200, 1],
      [250, 0],
    ],
  });
});

test("resolveEasingEnvelope can disable the left outside easing ramp", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 50, placement: "outside", left: false, right: true },
  );

  assert.deepEqual(envelope, {
    removeStart: 100,
    removeEnd: 250,
    points: [
      [100, 1],
      [200, 1],
      [250, 0],
    ],
  });
});

test("resolveEasingEnvelope can disable the right inside easing ramp", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 25, placement: "inside", left: true, right: false },
  );

  assert.deepEqual(envelope, {
    removeStart: 100,
    removeEnd: 200,
    points: [
      [100, 0],
      [125, 1],
      [175, 1],
      [200, 1],
    ],
  });
});

test("resolveEasingEnvelopes blends overlapping outside easing curves", () => {
  const envelopes = resolveEasingEnvelopes(
    [
      { start: 100, end: 200 },
      { start: 230, end: 330 },
    ],
    { percent: 50, placement: "outside" },
  );

  assert.deepEqual(envelopes, [
    {
      removeStart: 50,
      removeEnd: 380,
      points: [
        [50, 0],
        [100, 1],
        [200, 1],
        [215, 0.7],
        [230, 1],
        [330, 1],
        [380, 0],
      ],
    },
  ]);
  assert.equal(easingMultiplierAt(215, envelopes[0].points), 0.7);
});

test("composeEasedAutomationValue avoids accumulating a positive overlay twice", () => {
  assert.equal(composeEasedAutomationValue(1, 1, 0.4), 1);
  assert.equal(composeEasedAutomationValue(0.4, 1, 1), 1);
  assert.equal(composeEasedAutomationValue(0, 1, 0.7), 0.7);
});

test("composeEasedAutomationValue avoids accumulating a negative overlay twice", () => {
  assert.equal(composeEasedAutomationValue(-1, -1, 0.4), -1);
  assert.equal(composeEasedAutomationValue(-0.4, -1, 1), -1);
  assert.equal(composeEasedAutomationValue(0, -1, 0.7), -0.7);
});

test("easedAutomationIntersectionTimes includes crossings between existing and overlay curves", () => {
  const times = easedAutomationIntersectionTimes(
    [
      [50, 0],
      [100, 1],
      [200, 1],
      [250, 0],
    ],
    [
      [180, 0],
      [230, 1],
      [330, 1],
      [380, 0],
    ],
    1,
  );

  assert.deepEqual(times, [215]);
});

test("resolveEasingEnvelope keeps inside easing within the note range", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 25, placement: "inside" },
  );

  assert.deepEqual(envelope, {
    removeStart: 100,
    removeEnd: 200,
    points: [
      [100, 0],
      [125, 1],
      [175, 1],
      [200, 0],
    ],
  });
});

test("resolveEasingEnvelope collapses overlapping inside ramps at the midpoint", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 100, placement: "inside" },
  );

  assert.deepEqual(envelope, {
    removeStart: 100,
    removeEnd: 200,
    points: [
      [100, 0],
      [150, 1],
      [200, 0],
    ],
  });
});

test("easingMultiplierAt interpolates between envelope points", () => {
  const envelope = resolveEasingEnvelope(
    { start: 100, end: 200 },
    { percent: 50, placement: "outside" },
  );

  assert.equal(easingMultiplierAt(75, envelope.points), 0.5);
  assert.equal(easingMultiplierAt(150, envelope.points), 1);
  assert.equal(easingMultiplierAt(225, envelope.points), 0.5);
});

test("resolveEasingPlacement accepts SynthV ComboBox label values", () => {
  assert.equal(resolveEasingPlacement("Inside", 0), "inside");
  assert.equal(resolveEasingPlacement(0, 1), "outside");
  assert.equal(resolveEasingPlacement("unknown", 1), "inside");
});
