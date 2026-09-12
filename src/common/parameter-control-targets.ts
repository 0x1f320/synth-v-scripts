export const DEFINE_PRESET_LABEL = "Define Preset...";
export const EDIT_PRESET_LABEL = "Edit Preset...";
export const EXTRACT_PRESET_LABEL = "Extract Preset...";
export const DELETE_PRESET_LABEL = "Delete Preset";
export const EASING_PLACEMENT_LABELS = ["Outside", "Inside"];

export type PresetTargetKind = "definePreset" | "preset";
export type TargetSelectionAction = "none" | "definePreset";
export type DialogStatus = "yes" | "no" | "cancel" | "ok" | "unknown";
export type EasingPlacement = "outside" | "inside";

export interface BasicTargetChoice {
  label: string;
  kind?: PresetTargetKind;
  presetId?: string;
  typeName?: string;
}

export interface ParameterPresetEntry {
  label: string;
  typeName: string;
  amount: number;
  min?: number;
  max?: number;
}

export interface ParameterPresetEntryChoice {
  label: string;
  typeName: string;
  min?: number;
  max?: number;
}

export type PresetExtractionSource = "control" | "graph" | "unknown";

export interface ParameterPresetExtractionSample {
  label: string;
  typeName: string;
  values: number[];
  defaultValue: number;
  source: PresetExtractionSource;
  min?: number;
  max?: number;
}

export interface ParameterPreset {
  id: string;
  name: string;
  entries: ParameterPresetEntry[];
}

export interface ParameterPresetStore {
  version: 1;
  presets: ParameterPreset[];
  settings?: ParameterControlSettings;
}

export interface ParameterControlSettings {
  selectedTargetKey?: string;
  deltaByTarget?: TargetStoredValues;
  easingAmount?: number;
  easingPlacement?: EasingPlacement;
  easingLeft?: boolean;
  easingRight?: boolean;
  controlWrites?: { [typeName: string]: AutomationInterval[] };
}

export interface ParameterPresetDelta {
  label: string;
  typeName: string;
  delta: number;
}

export interface PresetControlChoice {
  label: string;
  kind: PresetTargetKind;
  presetId?: string;
}

export interface SavedPresetControlChoice extends PresetControlChoice {
  kind: "preset";
  presetId: string;
}

export type TargetChoice<T extends BasicTargetChoice> = T | PresetControlChoice;

export interface TargetSelectionInput<T extends BasicTargetChoice> {
  choices: Array<TargetChoice<T>>;
  nextIndex: unknown;
  previousIndex: number;
}

export interface TargetChangeInput<T extends BasicTargetChoice> {
  choices: Array<TargetChoice<T>>;
  callbackValue: unknown;
  currentValue: unknown;
  previousIndex: number;
}

export interface ParameterControlRowsInput {
  targetLabels: string[];
  parameterValue: WidgetValue;
  deltaValue: WidgetValue;
  deltaFormat: string;
  deltaLimit: number;
  deltaStep: number;
  easingValue: WidgetValue;
  easingLeftValue: WidgetValue;
  easingRightValue: WidgetValue;
  easingPlacementValue: WidgetValue;
  definePresetLabel: string;
  definePresetValue: WidgetValue;
  extractPresetValue: WidgetValue;
  deletePresetValue: WidgetValue;
  applyValue: WidgetValue;
  invertValue: WidgetValue;
}

export interface PresetActionState {
  definePresetLabel: string;
  deletePresetEnabled: boolean;
}

export interface AutomationInterval {
  start: number;
  end: number;
}

export interface EasingOptions {
  percent: number;
  placement: EasingPlacement;
  left?: boolean;
  right?: boolean;
}

export interface EasingEnvelope {
  removeStart: number;
  removeEnd: number;
  points: Array<[number, number]>;
}

export interface TargetStoredValues {
  [key: string]: number;
}

export interface TargetSelectionResult {
  action: TargetSelectionAction;
  index: number;
}

export function buildTargetChoices<T extends BasicTargetChoice>(
  choices: T[],
  presets: ParameterPreset[] = [],
): Array<TargetChoice<T>> {
  return [
    ...choices,
    ...presets.map((preset) => ({
      label: `Preset: ${preset.name}`,
      kind: "preset" as const,
      presetId: preset.id,
    })),
  ];
}

export function buildParameterControlRows(input: ParameterControlRowsInput): SVPanelRow[] {
  return [
    { type: "Label", text: "Target" },
    {
      type: "Container",
      columns: [
        {
          type: "ComboBox",
          choices: input.targetLabels,
          value: input.parameterValue,
          width: 1,
        },
      ],
    },
    {
      type: "Container",
      columns: [
        {
          type: "Slider",
          text: "Delta",
          format: input.deltaFormat,
          minValue: -input.deltaLimit,
          maxValue: input.deltaLimit,
          interval: input.deltaStep,
          value: input.deltaValue,
          width: 1,
        },
      ],
    },
    { type: "Label", text: "Easing" },
    {
      type: "Container",
      columns: [
        {
          type: "Slider",
          text: "Amount",
          format: "%1.0f %%",
          minValue: 0,
          maxValue: 100,
          interval: 1,
          value: input.easingValue,
          width: 1,
        },
      ],
    },
    {
      type: "Container",
      columns: [
        {
          type: "CheckBox",
          text: "Left",
          value: input.easingLeftValue,
          width: 1,
        },
        {
          type: "CheckBox",
          text: "Right",
          value: input.easingRightValue,
          width: 1,
        },
      ],
    },
    {
      type: "Container",
      columns: [
        {
          type: "ComboBox",
          choices: EASING_PLACEMENT_LABELS,
          value: input.easingPlacementValue,
          width: 1,
        },
      ],
    },
    {
      type: "Container",
      columns: [
        { type: "Button", text: "Apply", value: input.applyValue, width: 1 },
        { type: "Button", text: "Invert", value: input.invertValue, width: 1 },
      ],
    },
    {
      type: "Container",
      columns: [
        {
          type: "Button",
          text: input.definePresetLabel,
          value: input.definePresetValue,
          width: 1,
        },
        {
          type: "Button",
          text: EXTRACT_PRESET_LABEL,
          value: input.extractPresetValue,
          width: 1,
        },
      ],
    },
    {
      type: "Container",
      columns: [
        {
          type: "Button",
          text: DELETE_PRESET_LABEL,
          value: input.deletePresetValue,
          width: 1,
        },
      ],
    },
  ];
}

export function presetActionState(
  choice: BasicTargetChoice | PresetControlChoice,
): PresetActionState {
  if (isPresetChoice(choice)) {
    return {
      definePresetLabel: EDIT_PRESET_LABEL,
      deletePresetEnabled: true,
    };
  }

  return {
    definePresetLabel: DEFINE_PRESET_LABEL,
    deletePresetEnabled: false,
  };
}

export function collectUsableVocalModeNames(value: unknown): string[] {
  const discovered = uniqueSorted(discoverVocalModeNames(value));
  if (discovered.length > 0) {
    return discovered;
  }
  return uniqueSorted(currentVoiceVocalModeParams(value));
}

export function selectVocalModeReference<T>(currentReference: T, selectedReferences: T[]): T {
  return selectedReferences.length > 0 ? selectedReferences[0] : currentReference;
}

export function upsertPresetEntry(
  entries: ParameterPresetEntry[],
  entry: ParameterPresetEntry,
): ParameterPresetEntry[] {
  const replaced = entries.map((current) =>
    current.typeName === entry.typeName ? { ...entry } : { ...current },
  );
  if (entries.some((current) => current.typeName === entry.typeName)) {
    return replaced;
  }
  return entries.concat([{ ...entry }]);
}

export function resolvePresetDeltas(
  preset: ParameterPreset,
  deltaPercent: number,
): ParameterPresetDelta[] {
  const ratio = deltaPercent / 100;
  return preset.entries.map((entry) => ({
    label: entry.label,
    typeName: entry.typeName,
    delta: entry.amount * ratio,
  }));
}

export function serializeParameterControlStore(
  presets: ParameterPreset[],
  settings: ParameterControlSettings = {},
): string {
  const serializedSettings = settingsJson(settings);
  const store: { [key: string]: JsonValue } = {
    version: 1,
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      entries: preset.entries.map((entry) => presetEntryJson(entry)),
    })),
  };
  if (hasJsonFields(serializedSettings)) {
    store.settings = serializedSettings;
  }
  return jsonStringify(store);
}

export function serializeParameterPresetStore(presets: ParameterPreset[]): string {
  return serializeParameterControlStore(presets);
}

function hasJsonFields(value: { [key: string]: JsonValue }): boolean {
  for (const _key in value) {
    return true;
  }
  return false;
}

export function parseParameterControlStore(text: string): ParameterPresetStore {
  const value = parseJsonValue(text);
  if (!isJsonObject(value)) {
    return { version: 1, presets: [] };
  }

  return {
    version: 1,
    presets: parseStoredPresets(value),
    settings: normalizeStoredSettings(value.settings),
  };
}

export function parseParameterPresetStore(text: string): ParameterPreset[] {
  return parseParameterControlStore(text).presets;
}

function presetEntryJson(entry: ParameterPresetEntry): { [key: string]: JsonValue } {
  const result: { [key: string]: JsonValue } = {
    label: entry.label,
    typeName: entry.typeName,
    amount: entry.amount,
  };
  if (entry.min !== undefined) {
    result.min = entry.min;
  }
  if (entry.max !== undefined) {
    result.max = entry.max;
  }
  return result;
}

function settingsJson(settings: ParameterControlSettings): { [key: string]: JsonValue } {
  const result: { [key: string]: JsonValue } = {};
  if (settings.selectedTargetKey) {
    result.selectedTargetKey = settings.selectedTargetKey;
  }
  if (settings.deltaByTarget) {
    result.deltaByTarget = targetStoredValuesJson(settings.deltaByTarget);
  }
  if (typeof settings.easingAmount === "number" && Number.isFinite(settings.easingAmount)) {
    result.easingAmount = settings.easingAmount;
  }
  if (settings.easingPlacement) {
    result.easingPlacement = settings.easingPlacement;
  }
  if (typeof settings.easingLeft === "boolean") {
    result.easingLeft = settings.easingLeft;
  }
  if (typeof settings.easingRight === "boolean") {
    result.easingRight = settings.easingRight;
  }
  if (settings.controlWrites) {
    const controlWrites = controlWritesJson(settings.controlWrites);
    if (hasJsonFields(controlWrites)) {
      result.controlWrites = controlWrites;
    }
  }
  return result;
}

function targetStoredValuesJson(values: TargetStoredValues): { [key: string]: JsonValue } {
  const result: { [key: string]: JsonValue } = {};
  for (const key in values) {
    const value = values[key];
    if (Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

function controlWritesJson(values: { [typeName: string]: AutomationInterval[] }): {
  [key: string]: JsonValue;
} {
  const result: { [key: string]: JsonValue } = {};
  for (const typeName in values) {
    const intervals: JsonValue[] = [];
    values[typeName].forEach((interval) => {
      if (Number.isFinite(interval.start) && Number.isFinite(interval.end)) {
        intervals.push({ start: interval.start, end: interval.end });
      }
    });
    if (intervals.length > 0) {
      result[typeName] = intervals;
    }
  }
  return result;
}

function parseStoredPresets(value: { [key: string]: JsonValue }): ParameterPreset[] {
  const rawPresets = value.presets;
  if (!Array.isArray(rawPresets)) {
    return [];
  }

  const presets: ParameterPreset[] = [];
  for (let index = 0; index < rawPresets.length; index += 1) {
    const preset = normalizeStoredPreset(rawPresets[index]);
    if (preset) {
      presets.push(preset);
    }
  }
  return presets;
}

function normalizeStoredSettings(value: JsonValue | undefined): ParameterControlSettings {
  if (value === undefined || !isJsonObject(value)) {
    return {};
  }

  const settings: ParameterControlSettings = {};
  if (typeof value.selectedTargetKey === "string") {
    settings.selectedTargetKey = value.selectedTargetKey;
  }
  settings.deltaByTarget = normalizeStoredTargetValues(value.deltaByTarget);
  if (typeof value.easingAmount === "number" && Number.isFinite(value.easingAmount)) {
    settings.easingAmount = clampNumber(value.easingAmount, 0, 100);
  }
  if (value.easingPlacement === "outside" || value.easingPlacement === "inside") {
    settings.easingPlacement = value.easingPlacement;
  }
  if (typeof value.easingLeft === "boolean") {
    settings.easingLeft = value.easingLeft;
  }
  if (typeof value.easingRight === "boolean") {
    settings.easingRight = value.easingRight;
  }
  settings.controlWrites = normalizeStoredControlWrites(value.controlWrites);
  return settings;
}

function normalizeStoredTargetValues(value: JsonValue | undefined): TargetStoredValues {
  const result: TargetStoredValues = {};
  if (value === undefined || !isJsonObject(value)) {
    return result;
  }

  for (const key in value) {
    const storedValue = value[key];
    if (typeof storedValue === "number" && Number.isFinite(storedValue)) {
      result[key] = storedValue;
    }
  }
  return result;
}

function normalizeStoredControlWrites(value: JsonValue | undefined): {
  [typeName: string]: AutomationInterval[];
} {
  const result: { [typeName: string]: AutomationInterval[] } = {};
  if (value === undefined || !isJsonObject(value)) {
    return result;
  }

  for (const typeName in value) {
    const rawIntervals = value[typeName];
    if (!Array.isArray(rawIntervals)) {
      continue;
    }
    const intervals: AutomationInterval[] = [];
    rawIntervals.forEach((rawInterval) => {
      if (
        isJsonObject(rawInterval) &&
        typeof rawInterval.start === "number" &&
        Number.isFinite(rawInterval.start) &&
        typeof rawInterval.end === "number" &&
        Number.isFinite(rawInterval.end)
      ) {
        intervals.push({
          start: Math.min(rawInterval.start, rawInterval.end),
          end: Math.max(rawInterval.start, rawInterval.end),
        });
      }
    });
    if (intervals.length > 0) {
      result[typeName] = normalizeAutomationIntervals(intervals);
    }
  }
  return result;
}

export function presetEntriesFromSliderAnswers(
  choices: ParameterPresetEntryChoice[],
  answers: { [name: string]: unknown },
): ParameterPresetEntry[] {
  const entries: ParameterPresetEntry[] = [];
  choices.forEach((choice, index) => {
    const amount = Number(answers[presetAmountWidgetName(index)]);
    if (!Number.isFinite(amount) || amount === 0) {
      return;
    }

    entries.push({
      label: choice.label,
      typeName: choice.typeName,
      amount,
      min: choice.min,
      max: choice.max,
    });
  });
  return entries;
}

export function presetAmountWidgetName(index: number): string {
  return `amount_${Math.max(0, Math.trunc(index))}`;
}

export function extractedPresetEntriesFromSamples(
  samples: ParameterPresetExtractionSample[],
): ParameterPresetEntry[] {
  const entries: ParameterPresetEntry[] = [];
  samples.forEach((sample) => {
    const values = finiteNumbers(sample.values);
    if (values.length === 0) {
      return;
    }

    const amount = median(values);
    if (
      sample.source === "unknown" ||
      !Number.isFinite(amount) ||
      Math.abs(amount - sample.defaultValue) < 0.000001
    ) {
      return;
    }

    entries.push({
      label: `${sample.label} [${sourceLabel(sample.source)}]`,
      typeName: sample.typeName,
      amount,
      min: sample.min,
      max: sample.max,
    });
  });
  return entries;
}

export function customDialogSliderFormat(format: string): string {
  const text = String(format);
  if (text.length < 3 || text[0] !== "%") {
    return "%1.2f";
  }

  let index = 1;
  while (isDigit(text[index])) {
    index += 1;
  }

  if (text[index] === ".") {
    index += 1;
    const decimalStart = index;
    while (isDigit(text[index])) {
      index += 1;
    }
    if (decimalStart === index) {
      return "%1.2f";
    }
  }

  if (text[index] !== "f") {
    return "%1.2f";
  }
  return text.slice(0, index + 1);
}

export function presetDialogTargetChoices<T extends BasicTargetChoice>(choices: T[]): T[] {
  return choices.filter((choice) => {
    if (choice.typeName === "rapIntonation") {
      return false;
    }
    return typeof choice.typeName === "string" && !choice.typeName.startsWith("vocalMode_");
  });
}

export function extractPresetTargetChoices<T extends BasicTargetChoice>(choices: T[]): T[] {
  return choices.filter((choice) => {
    if (choice.typeName === "rapIntonation") {
      return false;
    }
    return typeof choice.typeName === "string" && choice.typeName !== "";
  });
}

export function replacePresetEntriesFromSliderAnswers(
  entries: ParameterPresetEntry[],
  choices: ParameterPresetEntryChoice[],
  answers: { [name: string]: unknown },
): ParameterPresetEntry[] {
  const replacing: { [typeName: string]: boolean } = {};
  choices.forEach((choice) => {
    replacing[choice.typeName] = true;
  });

  return entries
    .filter((entry) => !replacing[entry.typeName])
    .concat(presetEntriesFromSliderAnswers(choices, answers));
}

export function normalizeDialogStatus(status: unknown): DialogStatus {
  if (status === undefined || status === null) {
    return "cancel";
  }
  if (status === true) {
    return "ok";
  }
  if (status === false) {
    return "cancel";
  }

  const text = String(status ?? "").toLowerCase();
  if (text === "yes" || text === "no" || text === "cancel" || text === "ok") {
    return text;
  }
  return "unknown";
}

export function resolveEasingPlacement(value: unknown, fallbackIndex: number): EasingPlacement {
  const index = resolveLabelIndex(EASING_PLACEMENT_LABELS, value, fallbackIndex);
  return index === 1 ? "inside" : "outside";
}

export function resolveEasingEnvelope(
  interval: AutomationInterval,
  options: EasingOptions,
): EasingEnvelope {
  const start = Math.min(interval.start, interval.end);
  const end = Math.max(interval.start, interval.end);
  const duration = Math.max(0, end - start);
  const percent = clampNumber(options.percent, 0, 100);
  const left = options.left !== false;
  const right = options.right !== false;
  if (duration === 0 || percent <= 0) {
    return {
      removeStart: start,
      removeEnd: end,
      points: [
        [start, 1],
        [end, 1],
      ],
    };
  }

  const rawLength = duration * (percent / 100);
  if (!left && !right) {
    return {
      removeStart: start,
      removeEnd: end,
      points: [
        [start, 1],
        [end, 1],
      ],
    };
  }

  if (options.placement === "inside") {
    const length = Math.min(rawLength, duration / 2);
    return {
      removeStart: start,
      removeEnd: end,
      points: simplifyEasingPoints([
        [start, left ? 0 : 1],
        [start + length, 1],
        [end - length, 1],
        [end, right ? 0 : 1],
      ]),
    };
  }

  return {
    removeStart: left ? Math.max(0, start - rawLength) : start,
    removeEnd: right ? end + rawLength : end,
    points: simplifyEasingPoints([
      [left ? Math.max(0, start - rawLength) : start, left ? 0 : 1],
      [start, 1],
      [end, 1],
      [right ? end + rawLength : end, right ? 0 : 1],
    ]),
  };
}

export function resolveEasingEnvelopes(
  intervals: AutomationInterval[],
  options: EasingOptions,
): EasingEnvelope[] {
  const normalizedIntervals = normalizeAutomationIntervals(intervals);
  if (options.placement !== "outside") {
    return normalizedIntervals.map((interval) => resolveEasingEnvelope(interval, options));
  }

  const envelopes: EasingEnvelope[] = [];
  let groupEnvelopes: EasingEnvelope[] = [];
  let groupRemoveStart = 0;
  let groupRemoveEnd = 0;

  normalizedIntervals.forEach((interval) => {
    const envelope = resolveEasingEnvelope(interval, options);
    if (groupEnvelopes.length === 0) {
      groupEnvelopes = [envelope];
      groupRemoveStart = envelope.removeStart;
      groupRemoveEnd = envelope.removeEnd;
      return;
    }

    if (envelope.removeStart <= groupRemoveEnd) {
      groupEnvelopes.push(envelope);
      groupRemoveEnd = Math.max(groupRemoveEnd, envelope.removeEnd);
      return;
    }

    envelopes.push(
      buildBlendedOutsideEasingEnvelope(groupEnvelopes, groupRemoveStart, groupRemoveEnd),
    );
    groupEnvelopes = [envelope];
    groupRemoveStart = envelope.removeStart;
    groupRemoveEnd = envelope.removeEnd;
  });

  if (groupEnvelopes.length > 0) {
    envelopes.push(
      buildBlendedOutsideEasingEnvelope(groupEnvelopes, groupRemoveStart, groupRemoveEnd),
    );
  }

  return envelopes;
}

export function easingMultiplierAt(time: number, points: Array<[number, number]>): number {
  if (points.length === 0) {
    return 1;
  }
  if (time <= points[0][0]) {
    return points[0][1];
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (time <= current[0]) {
      const span = current[0] - previous[0];
      if (span <= 0) {
        return current[1];
      }
      const ratio = (time - previous[0]) / span;
      return previous[1] + (current[1] - previous[1]) * ratio;
    }
  }

  return points[points.length - 1][1];
}

export function composeEasedAutomationValue(
  existingValue: number,
  delta: number,
  multiplier: number,
): number {
  const overlayValue = delta * multiplier;
  if (delta > 0 && existingValue >= 0 && existingValue <= delta) {
    return Math.max(existingValue, overlayValue);
  }
  if (delta < 0 && existingValue <= 0 && existingValue >= delta) {
    return Math.min(existingValue, overlayValue);
  }
  return existingValue + overlayValue;
}

export function easedAutomationIntersectionTimes(
  existingPoints: Array<[number, number]>,
  envelopePoints: Array<[number, number]>,
  delta: number,
): number[] {
  const times: number[] = [];
  const overlayPoints = envelopePoints.map(
    (point) => [point[0], point[1] * delta] as [number, number],
  );
  addPiecewiseIntersectionTimes(times, existingPoints, overlayPoints);
  times.sort((left, right) => left - right);
  return times;
}

export function isDefinePresetChoice(choice: BasicTargetChoice | undefined): boolean {
  return choice?.kind === "definePreset";
}

export function isPresetChoice(
  choice: BasicTargetChoice | PresetControlChoice | undefined,
): choice is SavedPresetControlChoice {
  return choice?.kind === "preset" && typeof choice.presetId === "string";
}

export function resolveTargetSelection<T extends BasicTargetChoice>(
  input: TargetSelectionInput<T>,
): TargetSelectionResult {
  const nextIndex = resolveChoiceIndex(input.choices, input.nextIndex);
  const nextChoice = nextIndex >= 0 ? input.choices[nextIndex] : undefined;
  const fallbackIndex = validFallbackIndex(input.choices, input.previousIndex);

  if (isDefinePresetChoice(nextChoice)) {
    return { action: "definePreset", index: fallbackIndex };
  }

  return {
    action: "none",
    index: isRealTargetChoice(nextChoice) ? nextIndex : fallbackIndex,
  };
}

export function resolveTargetChange<T extends BasicTargetChoice>(
  input: TargetChangeInput<T>,
): TargetSelectionResult {
  return resolveTargetSelection({
    choices: input.choices,
    nextIndex: input.callbackValue === undefined ? input.currentValue : input.callbackValue,
    previousIndex: input.previousIndex,
  });
}

export function saveTargetValue<T extends BasicTargetChoice>(
  values: TargetStoredValues,
  choice: TargetChoice<T> | undefined,
  value: number,
): void {
  const key = targetValueKey(choice);
  if (key && Number.isFinite(value)) {
    values[key] = value;
  }
}

export function restoreTargetValue<T extends BasicTargetChoice>(
  values: TargetStoredValues,
  choice: TargetChoice<T> | undefined,
  fallback: number,
): number {
  const key = targetValueKey(choice);
  if (key) {
    const value = values[key];
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

export function targetValueKey<T extends BasicTargetChoice>(
  choice: TargetChoice<T> | undefined,
): string | undefined {
  if (!choice || isDefinePresetChoice(choice)) {
    return undefined;
  }
  if (isPresetChoice(choice)) {
    return `preset:${choice.presetId}`;
  }
  if ("typeName" in choice && choice.typeName) {
    return `target:${choice.typeName}`;
  }
  return undefined;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeStoredPreset(value: JsonValue): ParameterPreset | undefined {
  if (!isJsonObject(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return undefined;
  }
  if (!Array.isArray(value.entries)) {
    return undefined;
  }

  const entries: ParameterPresetEntry[] = [];
  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = normalizeStoredPresetEntry(value.entries[index]);
    if (entry) {
      entries.push(entry);
    }
  }
  if (entries.length === 0) {
    return undefined;
  }

  return {
    id: value.id,
    name: value.name,
    entries,
  };
}

function normalizeStoredPresetEntry(value: JsonValue): ParameterPresetEntry | undefined {
  if (
    !isJsonObject(value) ||
    typeof value.label !== "string" ||
    typeof value.typeName !== "string" ||
    typeof value.amount !== "number" ||
    !Number.isFinite(value.amount)
  ) {
    return undefined;
  }

  const entry: ParameterPresetEntry = {
    label: value.label,
    typeName: value.typeName,
    amount: value.amount,
  };
  if (typeof value.min === "number" && Number.isFinite(value.min)) {
    entry.min = value.min;
  }
  if (typeof value.max === "number" && Number.isFinite(value.max)) {
    entry.max = value.max;
  }
  return entry;
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return !!(value && typeof value === "object" && !Array.isArray(value));
}

function jsonStringify(value: JsonValue): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return jsonString(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      items.push(jsonStringify(value[index]));
    }
    return `[${items.join(",")}]`;
  }

  const fields: string[] = [];
  for (const key in value) {
    const fieldValue = value[key];
    if (fieldValue !== undefined) {
      fields.push(`${jsonString(key)}:${jsonStringify(fieldValue)}`);
    }
  }
  return `{${fields.join(",")}}`;
}

function jsonString(value: string): string {
  let result = '"';
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    const code = value.charCodeAt(index);
    if (char === '"' || char === "\\") {
      result += `\\${char}`;
    } else if (char === "\b") {
      result += "\\b";
    } else if (char === "\f") {
      result += "\\f";
    } else if (char === "\n") {
      result += "\\n";
    } else if (char === "\r") {
      result += "\\r";
    } else if (char === "\t") {
      result += "\\t";
    } else if (code < 32) {
      result += `\\u${leftPad(code.toString(16), 4)}`;
    } else {
      result += char;
    }
  }
  return `${result}"`;
}

function leftPad(value: string, length: number): string {
  let result = value;
  while (result.length < length) {
    result = `0${result}`;
  }
  return result;
}

function parseJsonValue(text: string): JsonValue {
  let index = 0;

  function skipWhitespace(): void {
    while (index < text.length && isJsonWhitespace(text.charAt(index))) {
      index += 1;
    }
  }

  function parseValue(): JsonValue {
    skipWhitespace();
    const char = text.charAt(index);
    if (char === "{") {
      return parseObject();
    }
    if (char === "[") {
      return parseArray();
    }
    if (char === '"') {
      return parseString();
    }
    if (text.substring(index, index + 4) === "true") {
      index += 4;
      return true;
    }
    if (text.substring(index, index + 5) === "false") {
      index += 5;
      return false;
    }
    if (text.substring(index, index + 4) === "null") {
      index += 4;
      return null;
    }
    return parseNumber();
  }

  function parseObject(): { [key: string]: JsonValue } {
    const result: { [key: string]: JsonValue } = {};
    index += 1;
    skipWhitespace();
    if (text.charAt(index) === "}") {
      index += 1;
      return result;
    }

    while (index < text.length) {
      skipWhitespace();
      const key = parseString();
      skipWhitespace();
      if (text.charAt(index) !== ":") {
        throw new Error("Expected ':' in JSON object.");
      }
      index += 1;
      result[key] = parseValue();
      skipWhitespace();
      const char = text.charAt(index);
      if (char === "}") {
        index += 1;
        return result;
      }
      if (char !== ",") {
        throw new Error("Expected ',' in JSON object.");
      }
      index += 1;
    }
    throw new Error("Unterminated JSON object.");
  }

  function parseArray(): JsonValue[] {
    const result: JsonValue[] = [];
    index += 1;
    skipWhitespace();
    if (text.charAt(index) === "]") {
      index += 1;
      return result;
    }

    while (index < text.length) {
      result.push(parseValue());
      skipWhitespace();
      const char = text.charAt(index);
      if (char === "]") {
        index += 1;
        return result;
      }
      if (char !== ",") {
        throw new Error("Expected ',' in JSON array.");
      }
      index += 1;
    }
    throw new Error("Unterminated JSON array.");
  }

  function parseString(): string {
    if (text.charAt(index) !== '"') {
      throw new Error("Expected JSON string.");
    }
    index += 1;
    let result = "";
    while (index < text.length) {
      const char = text.charAt(index);
      index += 1;
      if (char === '"') {
        return result;
      }
      if (char !== "\\") {
        result += char;
        continue;
      }

      const escaped = text.charAt(index);
      index += 1;
      if (escaped === '"' || escaped === "\\" || escaped === "/") {
        result += escaped;
      } else if (escaped === "b") {
        result += "\b";
      } else if (escaped === "f") {
        result += "\f";
      } else if (escaped === "n") {
        result += "\n";
      } else if (escaped === "r") {
        result += "\r";
      } else if (escaped === "t") {
        result += "\t";
      } else if (escaped === "u") {
        const hex = text.substring(index, index + 4);
        if (!isHexString(hex)) {
          throw new Error("Invalid unicode escape in JSON string.");
        }
        result += String.fromCharCode(Number.parseInt(hex, 16));
        index += 4;
      } else {
        throw new Error("Invalid escape in JSON string.");
      }
    }
    throw new Error("Unterminated JSON string.");
  }

  function parseNumber(): number {
    const start = index;
    if (text.charAt(index) === "-") {
      index += 1;
    }
    while (isDigit(text.charAt(index))) {
      index += 1;
    }
    if (text.charAt(index) === ".") {
      index += 1;
      while (isDigit(text.charAt(index))) {
        index += 1;
      }
    }
    const exp = text.charAt(index);
    if (exp === "e" || exp === "E") {
      index += 1;
      const sign = text.charAt(index);
      if (sign === "+" || sign === "-") {
        index += 1;
      }
      while (isDigit(text.charAt(index))) {
        index += 1;
      }
    }
    const numberText = text.substring(start, index);
    const value = Number(numberText);
    if (!Number.isFinite(value)) {
      throw new Error("Invalid JSON number.");
    }
    return value;
  }

  try {
    const value = parseValue();
    skipWhitespace();
    if (index !== text.length) {
      return null;
    }
    return value;
  } catch (_error) {
    return null;
  }
}

function isJsonWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}

function isHexString(value: string): boolean {
  if (value.length !== 4) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    if (!isDigit(char) && !(char >= "a" && char <= "f") && !(char >= "A" && char <= "F")) {
      return false;
    }
  }
  return true;
}

function resolveChoiceIndex<T extends BasicTargetChoice>(
  choices: Array<TargetChoice<T>>,
  value: unknown,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampIndex(value, choices.length);
  }

  if (typeof value === "string") {
    const text = trimAsciiWhitespace(value);
    if (text !== "") {
      const numeric = Number(text);
      if (Number.isFinite(numeric)) {
        return clampIndex(numeric, choices.length);
      }
    }

    for (let index = 0; index < choices.length; index += 1) {
      if (choices[index].label === text) {
        return index;
      }
    }
  }

  return -1;
}

function resolveLabelIndex(labels: string[], value: unknown, fallbackIndex: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampIndex(value, labels.length);
  }

  if (typeof value === "string") {
    const text = trimAsciiWhitespace(value);
    if (text !== "") {
      const numeric = Number(text);
      if (Number.isFinite(numeric)) {
        return clampIndex(numeric, labels.length);
      }
    }

    for (let index = 0; index < labels.length; index += 1) {
      if (labels[index] === text) {
        return index;
      }
    }
  }

  return clampIndex(fallbackIndex, labels.length);
}

function simplifyEasingPoints(points: Array<[number, number]>): Array<[number, number]> {
  const simplified: Array<[number, number]> = [];
  points.forEach((point) => {
    const previous = simplified[simplified.length - 1];
    if (previous && previous[0] === point[0]) {
      previous[1] = Math.max(previous[1], point[1]);
      return;
    }
    simplified.push([point[0], point[1]]);
  });
  return simplified;
}

function normalizeAutomationIntervals(intervals: AutomationInterval[]): AutomationInterval[] {
  const sorted = intervals
    .map((interval) => ({
      start: Math.min(interval.start, interval.end),
      end: Math.max(interval.start, interval.end),
    }))
    .sort((left, right) => left.start - right.start);
  const merged: AutomationInterval[] = [];

  sorted.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ start: interval.start, end: interval.end });
      return;
    }
    previous.end = Math.max(previous.end, interval.end);
  });

  return merged;
}

function buildBlendedOutsideEasingEnvelope(
  envelopes: EasingEnvelope[],
  removeStart: number,
  removeEnd: number,
): EasingEnvelope {
  const times: number[] = [removeStart, removeEnd];
  envelopes.forEach((envelope) => {
    envelope.points.forEach((point) => {
      addUniqueNumber(times, point[0]);
    });
  });
  addEnvelopeIntersectionTimes(times, envelopes);
  times.sort((left, right) => left - right);

  const points: Array<[number, number]> = [];
  times.forEach((time) => {
    if (time >= removeStart && time <= removeEnd) {
      points.push([time, maxEnvelopeMultiplierAt(time, envelopes)]);
    }
  });

  return {
    removeStart,
    removeEnd,
    points: simplifyEasingPoints(removeCollinearEasingPoints(points)),
  };
}

function removeCollinearEasingPoints(points: Array<[number, number]>): Array<[number, number]> {
  const simplified: Array<[number, number]> = [];
  points.forEach((point) => {
    simplified.push(point);
    while (simplified.length >= 3) {
      const lastIndex = simplified.length - 1;
      if (
        !isCollinearEasingPoint(
          simplified[lastIndex - 2],
          simplified[lastIndex - 1],
          simplified[lastIndex],
        )
      ) {
        break;
      }
      simplified.splice(lastIndex - 1, 1);
    }
  });
  return simplified;
}

function isCollinearEasingPoint(
  start: [number, number],
  middle: [number, number],
  end: [number, number],
): boolean {
  const leftSpan = middle[0] - start[0];
  const rightSpan = end[0] - middle[0];
  const totalSpan = end[0] - start[0];
  if (leftSpan <= 0 || rightSpan <= 0 || totalSpan <= 0) {
    return false;
  }
  const expected = start[1] + ((end[1] - start[1]) * leftSpan) / totalSpan;
  return Math.abs(expected - middle[1]) < 0.000001;
}

function addEnvelopeIntersectionTimes(times: number[], envelopes: EasingEnvelope[]): void {
  for (let leftIndex = 0; leftIndex < envelopes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < envelopes.length; rightIndex += 1) {
      addPiecewiseIntersectionTimes(
        times,
        envelopes[leftIndex].points,
        envelopes[rightIndex].points,
      );
    }
  }
}

function addPiecewiseIntersectionTimes(
  times: number[],
  leftPoints: Array<[number, number]>,
  rightPoints: Array<[number, number]>,
): void {
  for (let leftIndex = 1; leftIndex < leftPoints.length; leftIndex += 1) {
    const leftStart = leftPoints[leftIndex - 1];
    const leftEnd = leftPoints[leftIndex];
    for (let rightIndex = 1; rightIndex < rightPoints.length; rightIndex += 1) {
      const rightStart = rightPoints[rightIndex - 1];
      const rightEnd = rightPoints[rightIndex];
      const start = Math.max(leftStart[0], rightStart[0]);
      const end = Math.min(leftEnd[0], rightEnd[0]);
      if (start >= end) {
        continue;
      }

      const leftSlope = segmentSlope(leftStart, leftEnd);
      const rightSlope = segmentSlope(rightStart, rightEnd);
      if (leftSlope === rightSlope) {
        continue;
      }

      const leftIntercept = leftStart[1] - leftSlope * leftStart[0];
      const rightIntercept = rightStart[1] - rightSlope * rightStart[0];
      const time = (rightIntercept - leftIntercept) / (leftSlope - rightSlope);
      if (Number.isFinite(time) && time > start && time < end) {
        addUniqueNumber(times, time);
      }
    }
  }
}

function segmentSlope(start: [number, number], end: [number, number]): number {
  const span = end[0] - start[0];
  if (span === 0) {
    return 0;
  }
  return (end[1] - start[1]) / span;
}

function maxEnvelopeMultiplierAt(time: number, envelopes: EasingEnvelope[]): number {
  let multiplier = 0;
  envelopes.forEach((envelope) => {
    if (time >= envelope.removeStart && time <= envelope.removeEnd) {
      multiplier = Math.max(multiplier, easingMultiplierAt(time, envelope.points));
    }
  });
  return multiplier;
}

function addUniqueNumber(values: number[], value: number): void {
  if (!Number.isFinite(value)) {
    return;
  }
  for (let index = 0; index < values.length; index += 1) {
    if (Math.abs(values[index] - value) < 0.000001) {
      return;
    }
  }
  values.push(value);
}

function discoverVocalModeNames(value: unknown, visited: unknown[] = [], depth = 0): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (depth > 4 || visited.indexOf(value) >= 0) {
    return [];
  }

  const object = value as { [key: string]: unknown };
  const names: string[] = [];
  const nextVisited = visited.concat([value]);

  Object.keys(object).forEach((key) => {
    const child = object[key];
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "groupdata" && child && typeof child === "object") {
      const group = child as { [key: string]: unknown };
      names.push(...namesFromList(group.vocalModes));
      return;
    }
    if (
      normalizedKey === "usingvoiceinfovocalmodes" ||
      normalizedKey === "usingvoiceinfodetailedvocalmodes"
    ) {
      names.push(...namesFromList(child));
      return;
    }
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const nested = discoverVocalModeNames(child, nextVisited, depth + 1);
      names.push(...nested);
    }
  });

  return names;
}

function currentVoiceVocalModeParams(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const object = value as { [key: string]: unknown };
  const names: string[] = [];
  addVocalModeParamNames(names, object.voice);
  addVocalModeParamNames(names, object.voiceData);
  return names;
}

function addVocalModeParamNames(names: string[], value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const object = value as { [key: string]: unknown };
  const params = object.vocalModeParams;
  if (params && typeof params === "object" && !Array.isArray(params)) {
    names.push(...Object.keys(params as { [key: string]: unknown }));
  }
}

function validFallbackIndex<T extends BasicTargetChoice>(
  choices: Array<TargetChoice<T>>,
  previousIndex: number,
): number {
  const clampedPrevious = clampIndex(previousIndex, choices.length);
  if (isRealTargetChoice(choices[clampedPrevious])) {
    return clampedPrevious;
  }

  for (let index = 0; index < choices.length; index += 1) {
    if (isRealTargetChoice(choices[index])) {
      return index;
    }
  }
  return 0;
}

function isRealTargetChoice(choice: BasicTargetChoice | undefined): boolean {
  return (choice !== undefined && !choice.kind && !!choice.typeName) || isPresetChoice(choice);
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, Math.trunc(index)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function finiteNumbers(values: number[]): number[] {
  const result: number[] = [];
  values.forEach((value) => {
    if (Number.isFinite(value)) {
      result.push(value);
    }
  });
  return result;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function sourceLabel(source: PresetExtractionSource): string {
  if (source === "control") {
    return "Control";
  }
  if (source === "graph") {
    return "Graph";
  }
  return "Unknown";
}

function namesFromList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const object = item as { [key: string]: unknown };
          return String(object.name ?? object.displayName ?? object.label ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as { [key: string]: unknown }).sort(compareCaseInsensitive);
  }
  return [];
}

function uniqueSorted(values: string[]): string[] {
  const seen: { [key: string]: boolean } = {};
  const unique: string[] = [];
  values.forEach((value) => {
    const trimmed = trimAsciiWhitespace(value);
    const key = trimmed.toLowerCase();
    if (trimmed && !seen[key]) {
      seen[key] = true;
      unique.push(trimmed);
    }
  });
  return unique.sort(compareCaseInsensitive);
}

export function trimAsciiWhitespace(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && isAsciiWhitespace(value[start])) {
    start += 1;
  }
  while (end > start && isAsciiWhitespace(value[end - 1])) {
    end -= 1;
  }
  return value.slice(start, end);
}

function compareCaseInsensitive(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  if (normalizedLeft < normalizedRight) {
    return -1;
  }
  if (normalizedLeft > normalizedRight) {
    return 1;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "0" && value <= "9";
}

function isAsciiWhitespace(value: string | undefined): boolean {
  return value === " " || value === "\n" || value === "\r" || value === "\t";
}
