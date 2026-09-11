import { getClientInfoFactory } from "@/common/client-info";
import {
  type AutomationInterval,
  buildParameterControlRows,
  buildTargetChoices,
  collectUsableVocalModeNames,
  composeEasedAutomationValue,
  customDialogSliderFormat,
  type EasingOptions,
  easedAutomationIntersectionTimes,
  easingMultiplierAt,
  extractedPresetEntriesFromSamples,
  extractPresetTargetChoices,
  isDefinePresetChoice,
  isPresetChoice,
  normalizeDialogStatus,
  type ParameterControlSettings,
  type ParameterPreset,
  type ParameterPresetEntry,
  type ParameterPresetStore,
  type PresetExtractionSource,
  parseParameterControlStore,
  presetActionState,
  presetAmountWidgetName,
  presetDialogTargetChoices,
  replacePresetEntriesFromSliderAnswers,
  resolveEasingEnvelopes,
  resolveEasingPlacement,
  resolvePresetDeltas,
  resolveTargetChange,
  resolveTargetSelection,
  restoreTargetValue,
  saveTargetValue,
  selectVocalModeReference,
  serializeParameterControlStore,
  type TargetChoice,
  type TargetStoredValues,
  targetValueKey,
  trimAsciiWhitespace,
} from "@/common/parameter-control-targets";

interface ParameterChoice {
  label: string;
  typeName: string;
  min: number;
  max: number;
  step: number;
  format: string;
  vocalMode?: boolean;
}

type ParameterTargetChoice = TargetChoice<ParameterChoice>;

interface AutomationEdit {
  removeStart: Blick;
  removeEnd: Blick;
  restoreBefore: Blick;
  restoreAfter: Blick;
  restoreBeforeValue: number;
  restoreAfterValue: number;
  points: WeightedAutomationPoint[];
}

interface WeightedAutomationPoint {
  time: Blick;
  value: number;
  multiplier: number;
}

interface LuaFile {
  read(this: LuaFile, mode: string): string;
  write(this: LuaFile, text: string): void;
  close(this: LuaFile): void;
}

interface PresetFileStore {
  available: boolean;
  path?: string;
  load(): ParameterPresetStore;
  save(presets: ParameterPreset[], settings: ParameterControlSettings): boolean;
}

interface ControlWriteRecords {
  [typeName: string]: Array<{ start: Blick; end: Blick }>;
}

declare const io:
  | {
      open: (this: void, path: string, mode: string) => LuaFile | undefined;
    }
  | undefined;
declare const debug:
  | {
      getinfo: (this: void, level: number, what?: string) => { source?: string };
    }
  | undefined;
declare const os:
  | {
      getenv: (this: void, name: string) => string | undefined;
    }
  | undefined;

const SCRIPT_TITLE = "Parameter Control";
const PRESET_STORE_FILE_NAME = ".parameter-control.json";
const DEBUG_LOG_FILE_NAME = ".parameter-control-debug.log";
const RESTORE_OFFSET = 1;
const CONTEXT_WATCH_INTERVAL = 500;
const PRESET_DIALOG_DELAY = 16;
const PRESET_DELTA_CHOICE: ParameterChoice = {
  label: "Preset",
  typeName: "",
  min: -200,
  max: 200,
  step: 1,
  format: "%1.0f %%",
};
const VOCAL_MODE_PARAMETER: ParameterChoice = {
  label: "Vocal Mode",
  typeName: "vocalMode_",
  min: 0,
  max: 150,
  step: 1,
  format: "%1.0f %%",
  vocalMode: true,
};

const BASE_PARAMETER_CHOICES: ParameterChoice[] = [
  {
    label: "Pitch Deviation",
    typeName: "pitchDelta",
    min: -1200,
    max: 1200,
    step: 5,
    format: "%1.0f cents",
  },
  {
    label: "Vibrato Envelope",
    typeName: "vibratoEnv",
    min: 0,
    max: 2,
    step: 0.01,
    format: "%1.2f x",
  },
  {
    label: "Loudness",
    typeName: "loudness",
    min: -48,
    max: 12,
    step: 0.1,
    format: "%1.1f dB",
  },
  {
    label: "Tension",
    typeName: "tension",
    min: -1,
    max: 1,
    step: 0.01,
    format: "%1.2f",
  },
  {
    label: "Breathiness",
    typeName: "breathiness",
    min: -1,
    max: 1,
    step: 0.01,
    format: "%1.2f",
  },
  {
    label: "Voicing",
    typeName: "voicing",
    min: 0,
    max: 1,
    step: 0.01,
    format: "%1.2f",
  },
  {
    label: "Gender",
    typeName: "gender",
    min: -1,
    max: 1,
    step: 0.01,
    format: "%1.2f",
  },
  {
    label: "Tone Shift",
    typeName: "toneShift",
    min: -800,
    max: 800,
    step: 5,
    format: "%1.0f",
  },
  {
    label: "Mouth Opening",
    typeName: "mouthOpening",
    min: 0,
    max: 1,
    step: 0.01,
    format: "%1.2f",
  },
  {
    label: "Rap Intonation",
    typeName: "rapIntonation",
    min: -0.5,
    max: 0.5,
    step: 0.01,
    format: "%1.2f",
  },
];

class ParameterControlPanel {
  private readonly parameter = this.reactive(0, (value) => this.onParameterChanged(value));
  private readonly delta = this.reactive(0, () => this.onStoredSettingChanged());
  private readonly easing = this.reactive(0, () => this.onStoredSettingChanged());
  private readonly easingLeft = this.reactive(true, () => this.onStoredSettingChanged());
  private readonly easingRight = this.reactive(true, () => this.onStoredSettingChanged());
  private readonly easingPlacement = this.reactive(0, () => this.onStoredSettingChanged());
  private readonly definePresetButton = SV.create("WidgetValue");
  private readonly extractPresetButton = SV.create("WidgetValue");
  private readonly deletePresetButton = SV.create("WidgetValue");
  private readonly applyButton = SV.create("WidgetValue");
  private readonly invertButton = SV.create("WidgetValue");
  private readonly presetStore = createPresetFileStore();
  private presets: ParameterPreset[] = [];
  private readonly deltaByTarget: TargetStoredValues = {};
  private readonly controlWrites: ControlWriteRecords = {};
  private nextPresetId = 1;
  private lastParameterIndex = 0;
  private resolvingParameter = false;
  private resettingButton = false;
  private lastContextSignature = "";
  private presetStoreWarningShown = false;
  private loadingStoredState = false;
  private restoringDeltaValue = false;

  constructor() {
    this.loadStoredState();
    debugLog("panel constructed");
    this.persistState();
    this.definePresetButton.setValue(false);
    this.definePresetButton.setEnabled(true);
    this.definePresetButton.setValueChangeCallback((value) =>
      this.runButtonAction(this.definePresetButton, "Define Preset", () =>
        this.deferPresetDialog(value),
      ),
    );
    this.extractPresetButton.setValue(false);
    this.extractPresetButton.setEnabled(false);
    this.extractPresetButton.setValueChangeCallback((value) =>
      this.runButtonAction(this.extractPresetButton, "Extract Preset", () =>
        this.deferExtractPresetDialog(value),
      ),
    );
    this.deletePresetButton.setValue(false);
    this.deletePresetButton.setEnabled(false);
    this.deletePresetButton.setValueChangeCallback((value) =>
      this.runButtonAction(this.deletePresetButton, "Delete Preset", () =>
        this.deferDeletePresetDialog(value),
      ),
    );
    this.applyButton.setValue(false);
    this.applyButton.setEnabled(true);
    this.applyButton.setValueChangeCallback(() =>
      this.runButtonAction(this.applyButton, "Apply", () => this.apply()),
    );
    this.invertButton.setValue(false);
    this.invertButton.setEnabled(true);
    this.invertButton.setValueChangeCallback(() =>
      this.runButtonAction(this.invertButton, "Invert", () => this.invertDelta()),
    );
    this.lastContextSignature = this.contextSignature();
    this.registerSelectionRefreshCallbacks();
    this.watchContext();
  }

  getState(): SVSidePanelState {
    const choices = this.targetChoices();
    this.ensureParameterIndex(choices);
    const choice = this.currentDeltaChoice(choices);
    const actionState = presetActionState(this.currentTarget(choices));
    const hasSelectedNotes = this.hasSelectedNotes();
    this.definePresetButton.setEnabled(true);
    this.extractPresetButton.setEnabled(hasSelectedNotes);
    this.deletePresetButton.setEnabled(actionState.deletePresetEnabled);
    this.applyButton.setEnabled(hasSelectedNotes);
    const deltaLimit = this.deltaLimit(choice);

    const rows = buildParameterControlRows({
      targetLabels: choices.map((option) => option.label),
      parameterValue: this.parameter,
      deltaValue: this.delta,
      deltaFormat: choice.format,
      deltaLimit,
      deltaStep: choice.step,
      easingValue: this.easing,
      easingLeftValue: this.easingLeft,
      easingRightValue: this.easingRight,
      easingPlacementValue: this.easingPlacement,
      definePresetLabel: actionState.definePresetLabel,
      definePresetValue: this.definePresetButton,
      extractPresetValue: this.extractPresetButton,
      deletePresetValue: this.deletePresetButton,
      applyValue: this.applyButton,
      invertValue: this.invertButton,
    });

    return {
      title: SCRIPT_TITLE,
      rows,
    };
  }

  private reactive(initial: number | boolean, onChange?: (value: unknown) => void): WidgetValue {
    const widget = SV.create("WidgetValue");
    widget.setValue(initial);
    widget.setValueChangeCallback((value) => {
      if (onChange) {
        onChange(value);
      }
    });
    return widget;
  }

  private showMessage(message: string, next?: () => void): void {
    debugLog(`message: ${message}`);
    if (typeof SV.showMessageBoxAsync === "function") {
      SV.showMessageBoxAsync(SCRIPT_TITLE, message, () => {
        if (next) {
          next();
        }
      });
      return;
    }

    if (typeof SV.showMessageBox === "function") {
      SV.showMessageBox(SCRIPT_TITLE, message);
      if (next) {
        next();
      }
      return;
    }

    SV.print(`${SCRIPT_TITLE}: ${message}`);
    if (next) {
      next();
    }
  }

  private runButtonAction(button: WidgetValue, label: string, action: () => void): void {
    debugLog(`${label}: button callback; resetting=${String(this.resettingButton)}`);
    if (this.resettingButton) {
      return;
    }

    try {
      debugLog(`${label}: action start`);
      action();
      debugLog(`${label}: action returned`);
    } catch (error) {
      debugLog(`${label}: action error ${this.errorMessage(error)}`);
      this.showMessage(`${label} failed: ${this.errorMessage(error)}`);
    } finally {
      debugLog(`${label}: reset button`);
      this.resetButton(button);
    }
  }

  private runDeferredAction(label: string, action: () => void): void {
    try {
      debugLog(`${label}: deferred start`);
      action();
      debugLog(`${label}: deferred returned`);
    } catch (error) {
      debugLog(`${label}: deferred error ${this.errorMessage(error)}`);
      this.showMessage(`${label} failed: ${this.errorMessage(error)}`);
    }
  }

  private resetButton(button: WidgetValue): void {
    this.resettingButton = true;
    button.setValue(false);
    this.resettingButton = false;
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message?: unknown }).message);
    }
    return String(error);
  }

  private deferPresetDialog(value: unknown): void {
    debugLog(`Define Preset: scheduling dialog; value=${String(value)}`);
    SV.setTimeout(PRESET_DIALOG_DELAY, () =>
      this.runDeferredAction("Define Preset", () => this.editOrDefinePreset()),
    );
  }

  private deferExtractPresetDialog(value: unknown): void {
    debugLog(`Extract Preset: scheduling dialog; value=${String(value)}`);
    SV.setTimeout(PRESET_DIALOG_DELAY, () =>
      this.runDeferredAction("Extract Preset", () => this.extractPreset()),
    );
  }

  private deferDeletePresetDialog(value: unknown): void {
    debugLog(`Delete Preset: scheduling confirmation; value=${String(value)}`);
    SV.setTimeout(PRESET_DIALOG_DELAY, () =>
      this.runDeferredAction("Delete Preset", () => this.confirmDeleteSelectedPreset()),
    );
  }

  private currentTarget(choices = this.targetChoices()): ParameterTargetChoice {
    const choice = choices[this.parameterIndex(choices)];
    if (choice && !isDefinePresetChoice(choice)) {
      return choice;
    }
    return this.firstParameterChoice(choices);
  }

  private currentDeltaChoice(choices = this.targetChoices()): ParameterChoice {
    const target = this.currentTarget(choices);
    if (isPresetChoice(target)) {
      return PRESET_DELTA_CHOICE;
    }
    if (this.isParameterChoice(target)) {
      return target;
    }
    return this.firstParameterChoice(choices);
  }

  private onParameterChanged(callbackValue: unknown): void {
    if (this.resolvingParameter) {
      return;
    }

    const choices = this.targetChoices();
    this.saveDeltaForIndex(choices, this.lastParameterIndex);
    const selection = resolveTargetChange({
      choices,
      callbackValue,
      currentValue: this.rawParameterValue(),
      previousIndex: this.lastParameterIndex,
    });
    const changedParameter =
      selection.index !== this.lastParameterIndex && selection.action === "none";

    this.setParameterIndex(selection.index);
    this.lastParameterIndex = selection.index;

    if (changedParameter) {
      this.restoreDeltaForChoice(choices[selection.index]);
    }
    this.persistState();
    SV.refreshSidePanel();
  }

  private onStoredSettingChanged(): void {
    if (this.loadingStoredState || this.restoringDeltaValue) {
      return;
    }
    this.persistState();
  }

  private invertDelta(): void {
    const choices = this.targetChoices();
    const index = this.parameterIndex(choices);
    const choice = choices[index];
    const value = this.normalizeDeltaValue(choice, -(Number(this.delta.getValue()) || 0));
    this.delta.setValue(value);
    this.saveDeltaForIndex(choices, index);
    this.persistState(choices);
    SV.refreshSidePanel();
  }

  private targetChoices(): ParameterTargetChoice[] {
    return buildTargetChoices(this.availableParameterChoices(), this.presets);
  }

  private availableParameterChoices(): ParameterChoice[] {
    return BASE_PARAMETER_CHOICES.concat(this.vocalModeChoices());
  }

  private vocalModeChoices(): ParameterChoice[] {
    return this.vocalModeNames().map((name) => ({
      label: `Vocal Mode: ${name}`,
      typeName: `${VOCAL_MODE_PARAMETER.typeName}${name}`,
      min: VOCAL_MODE_PARAMETER.min,
      max: VOCAL_MODE_PARAMETER.max,
      step: VOCAL_MODE_PARAMETER.step,
      format: VOCAL_MODE_PARAMETER.format,
      vocalMode: true,
    }));
  }

  private vocalModeNames(): string[] {
    return collectUsableVocalModeNames(this.currentVoiceContext());
  }

  private currentVoiceContext(): {
    reference?: NoteGroupReference;
    referenceData?: { [key: string]: unknown };
    groupData?: { [key: string]: unknown };
    voice: VoiceAttributes;
    voiceData?: { [key: string]: unknown };
  } {
    try {
      const editor = SV.getMainEditor();
      const reference = selectVocalModeReference(
        editor.getCurrentGroup(),
        editor.getSelection().getSelectedGroups(),
      );
      const group = reference.getTarget();
      const voice = reference.getVoice();
      return {
        reference,
        referenceData: this.jsonObject(reference),
        groupData: this.jsonObject(group),
        voice,
        voiceData: this.jsonObject(voice),
      };
    } catch (_error) {
      return { voice: {} };
    }
  }

  private jsonObject(source: unknown): { [key: string]: unknown } | undefined {
    try {
      const text = JSON.stringify(source);
      if (!text || text === "{}") {
        return undefined;
      }
      const value = JSON.parse(text);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as { [key: string]: unknown };
      }
    } catch (_error) {
      return undefined;
    }
    return undefined;
  }

  private currentReference(): NoteGroupReference {
    return SV.getMainEditor().getCurrentGroup();
  }

  private rawParameterValue(): unknown {
    return this.parameter.getValue();
  }

  private parameterIndex(choices: ParameterTargetChoice[]): number {
    return resolveTargetSelection({
      choices,
      nextIndex: this.rawParameterValue(),
      previousIndex: this.lastParameterIndex,
    }).index;
  }

  private ensureParameterIndex(choices: ParameterTargetChoice[]): void {
    const previousIndex = this.lastParameterIndex;
    const index = this.parameterIndex(choices);
    if (index !== this.parameter.getValue()) {
      this.saveDeltaForIndex(choices, previousIndex);
      this.setParameterIndex(index);
    }
    if (index !== previousIndex) {
      this.restoreDeltaForChoice(choices[index]);
    }
    this.lastParameterIndex = index;
  }

  private setParameterIndex(index: number): void {
    this.resolvingParameter = true;
    this.parameter.setValue(index);
    this.resolvingParameter = false;
  }

  private saveDeltaForIndex(choices: ParameterTargetChoice[], index: number): void {
    const choice = choices[index];
    saveTargetValue(
      this.deltaByTarget,
      choice,
      this.normalizeDeltaValue(choice, Number(this.delta.getValue()) || 0),
    );
  }

  private restoreDeltaValue(choice: ParameterTargetChoice | undefined): number {
    return this.normalizeDeltaValue(choice, restoreTargetValue(this.deltaByTarget, choice, 0));
  }

  private restoreDeltaForChoice(choice: ParameterTargetChoice | undefined): void {
    this.restoringDeltaValue = true;
    try {
      this.delta.setValue(this.restoreDeltaValue(choice));
    } finally {
      this.restoringDeltaValue = false;
    }
  }

  private firstParameterChoice(choices: ParameterTargetChoice[]): ParameterChoice {
    for (let index = 0; index < choices.length; index += 1) {
      const choice = choices[index];
      if (this.isParameterChoice(choice)) {
        return choice;
      }
    }
    return BASE_PARAMETER_CHOICES[0];
  }

  private isParameterChoice(choice: ParameterTargetChoice | undefined): choice is ParameterChoice {
    return !!(choice && !isDefinePresetChoice(choice) && "typeName" in choice && choice.typeName);
  }

  private editOrDefinePreset(): void {
    const target = this.currentTarget();
    debugLog(`Define Preset: resolved target ${target.label}`);
    if (isPresetChoice(target)) {
      this.editPreset(target.presetId);
      return;
    }

    this.definePreset();
  }

  private definePreset(): void {
    debugLog("Define Preset: definePreset start");
    const entryChoices = presetDialogTargetChoices(BASE_PARAMETER_CHOICES);
    debugLog(`Define Preset: entry choices ${String(entryChoices.length)}`);
    if (entryChoices.length === 0) {
      this.showMessage("No target parameters are available.");
      return;
    }

    const draft: ParameterPreset = {
      id: `preset-${this.nextPresetId}`,
      name: `Preset ${this.nextPresetId}`,
      entries: [],
    };

    this.openPresetDialog(draft, entryChoices);
  }

  private extractPreset(): void {
    debugLog("Extract Preset: start");
    const editor = SV.getMainEditor();
    const notes = editor.getSelection().getSelectedNotes();
    if (notes.length === 0) {
      this.showMessage("Select one or more notes first.");
      return;
    }

    const group = editor.getCurrentGroup().getTarget();
    const entries = this.extractPresetEntries(group, notes);
    debugLog(`Extract Preset: entries ${String(entries.length)}`);
    if (entries.length === 0) {
      this.openEmptyExtractDialog();
      return;
    }

    const draft: ParameterPreset = {
      id: `preset-${this.nextPresetId}`,
      name: `Preset ${this.nextPresetId}`,
      entries,
    };
    this.openPresetDialog(
      draft,
      entries.map((entry) => ({
        label: entry.label,
        typeName: entry.typeName,
        min: entry.min ?? -this.deltaLimit(PRESET_DELTA_CHOICE),
        max: entry.max ?? this.deltaLimit(PRESET_DELTA_CHOICE),
        step: this.choiceStep(entry.typeName),
        format: this.choiceFormat(entry.typeName),
      })),
    );
  }

  private editPreset(presetId: string): void {
    const preset = this.presetById(presetId);
    if (!preset) {
      this.showMessage("Preset not found.");
      return;
    }

    const entryChoices = presetDialogTargetChoices(BASE_PARAMETER_CHOICES);
    if (entryChoices.length === 0) {
      this.showMessage("No target parameters are available.");
      return;
    }

    this.openPresetDialog(
      {
        id: preset.id,
        name: preset.name,
        entries: preset.entries.map((entry) => ({ ...entry })),
      },
      entryChoices,
    );
  }

  private confirmDeleteSelectedPreset(): void {
    const target = this.currentTarget();
    if (!isPresetChoice(target)) {
      return;
    }

    const form: SVCustomDialogForm = {
      title: "Delete Preset",
      message: `Delete ${target.label}?`,
      buttons: "OkCancel",
      widgets: [],
    };

    try {
      debugLog(`Delete Preset: confirmation ${target.presetId}`);
      SV.showCustomDialogAsync(form, (result) => {
        const status = normalizeDialogStatus(dialogResultStatus(result));
        debugLog(`Delete Preset: confirmation returned ${status}`);
        if (status === "ok") {
          this.deletePresetById(target.presetId);
        }
      });
      debugLog("Delete Preset: confirmation scheduled");
    } catch (error) {
      debugLog(`Delete Preset: confirmation error ${this.errorMessage(error)}`);
      this.showMessage("Could not open delete confirmation.");
    }
  }

  private deletePresetById(presetId: string): void {
    const choices = this.targetChoices();
    this.saveDeltaForIndex(choices, this.lastParameterIndex);
    const remaining: ParameterPreset[] = [];
    for (let index = 0; index < this.presets.length; index += 1) {
      const preset = this.presets[index];
      if (preset.id !== presetId) {
        remaining.push(preset);
      }
    }
    this.presets = remaining;
    delete this.deltaByTarget[`preset:${presetId}`];
    const nextChoices = this.targetChoices();
    const nextIndex = this.validSelectionIndexAfterPresetDelete(
      nextChoices,
      this.lastParameterIndex,
    );
    this.setParameterIndex(nextIndex);
    this.lastParameterIndex = nextIndex;
    this.restoreDeltaForChoice(nextChoices[nextIndex]);
    this.persistState(nextChoices);
    SV.refreshSidePanel();
  }

  private openPresetDialog(draft: ParameterPreset, entryChoices: ParameterChoice[]): void {
    debugLog("Define Preset: open dialog");
    this.openPresetSliderDialog(draft, entryChoices);
  }

  private openEmptyExtractDialog(): void {
    debugLog("Extract Preset: no active entries");
    const form: SVCustomDialogForm = {
      title: "Extract Preset",
      message: "No active parameters were detected in the selected note range.",
      buttons: "OkCancel",
      widgets: [],
    };

    try {
      SV.showCustomDialogAsync(form, (result) => {
        debugLog(`Extract Preset: empty dialog returned ${String(dialogResultStatus(result))}`);
      });
      debugLog("Extract Preset: empty dialog scheduled");
    } catch (error) {
      debugLog(`Extract Preset: empty dialog error ${this.errorMessage(error)}`);
      this.showMessage("No active parameters were detected in the selected note range.");
    }
  }

  private openPresetSliderDialog(draft: ParameterPreset, entryChoices: ParameterChoice[]): void {
    const form = this.presetDialogForm(draft, entryChoices);
    debugLog(`Define Preset: form widgets ${String(form.widgets.length)}`);
    try {
      debugLog("Define Preset: trying showCustomDialogAsync");
      SV.showCustomDialogAsync(form, (result) => {
        debugLog(
          `Define Preset: showCustomDialogAsync returned ${String(dialogResultStatus(result))}`,
        );
        this.handlePresetDialogResult(draft, entryChoices, result);
      });
      debugLog("Define Preset: showCustomDialogAsync scheduled");
    } catch (error) {
      debugLog(`Define Preset: showCustomDialogAsync error ${this.errorMessage(error)}`);
      this.showMessage("Custom dialogs are not available in this SynthV runtime.");
    }
  }

  private handlePresetDialogResult(
    draft: ParameterPreset,
    entryChoices: ParameterChoice[],
    result: SVDialogResult | undefined,
  ): void {
    const status = normalizeDialogStatus(dialogResultStatus(result));
    const answers = dialogResultAnswers(result);
    debugLog(
      `Define Preset: normalized result ${status}; ${describeDialogResult(result, answers)}`,
    );
    if (status !== "ok") {
      return;
    }

    draft.name = this.normalizePresetName(answers.name, draft.name);
    draft.entries = replacePresetEntriesFromSliderAnswers(
      draft.entries,
      entryChoices.map((choice) => ({
        label: choice.label,
        typeName: this.parameterTypeName(choice),
        min: choice.min,
        max: choice.max,
      })),
      answers,
    );
    debugLog(`Define Preset: resolved entries ${String(draft.entries.length)}`);

    this.savePreset(draft);
  }

  private presetDialogForm(
    draft: ParameterPreset,
    entryChoices: ParameterChoice[],
  ): SVCustomDialogForm {
    const widgets: Array<{ [key: string]: unknown }> = [
      {
        name: "name",
        type: "TextBox",
        label: "Preset Name",
        default: draft.name,
      },
      ...this.presetAmountWidgets(draft, entryChoices),
    ];

    return {
      title: this.presetDialogTitle(draft),
      buttons: "OkCancel",
      widgets,
    };
  }

  private presetDialogTitle(draft: ParameterPreset): string {
    return this.presetById(draft.id) ? "Edit Preset" : "Define Preset";
  }

  private presetAmountWidgets(
    draft: ParameterPreset,
    entryChoices: ParameterChoice[],
  ): Array<{ [key: string]: unknown }> {
    return entryChoices.map((choice, index) => ({
      name: presetAmountWidgetName(index),
      type: "Slider",
      label: choice.label,
      format: customDialogSliderFormat(choice.format),
      minValue: -this.deltaLimit(choice),
      maxValue: this.deltaLimit(choice),
      interval: choice.step,
      default: this.presetEntryAmount(draft, choice),
    }));
  }

  private presetEntryAmount(preset: ParameterPreset, choice: ParameterChoice): number {
    const typeName = this.parameterTypeName(choice);
    for (let index = 0; index < preset.entries.length; index += 1) {
      const entry = preset.entries[index];
      if (entry.typeName === typeName) {
        return entry.amount;
      }
    }
    return 0;
  }

  private savePreset(preset: ParameterPreset): void {
    debugLog(`Define Preset: savePreset entries=${String(preset.entries.length)}`);
    if (preset.entries.length === 0) {
      this.showMessage("Preset must include at least one target.");
      return;
    }

    let existingIndex = -1;
    for (let index = 0; index < this.presets.length; index += 1) {
      if (this.presets[index].id === preset.id) {
        existingIndex = index;
        break;
      }
    }

    const savedPreset = {
      id: preset.id,
      name: preset.name,
      entries: preset.entries.map((entry) => ({ ...entry })),
    };

    if (existingIndex >= 0) {
      this.presets[existingIndex] = savedPreset;
    } else {
      this.presets.push(savedPreset);
      this.nextPresetId += 1;
    }

    const choices = this.targetChoices();
    let presetIndex = -1;
    for (let index = 0; index < choices.length; index += 1) {
      const choice = choices[index];
      if (isPresetChoice(choice) && choice.presetId === preset.id) {
        presetIndex = index;
        break;
      }
    }
    if (presetIndex >= 0) {
      this.saveDeltaForIndex(choices, this.lastParameterIndex);
      this.setParameterIndex(presetIndex);
      this.lastParameterIndex = presetIndex;
      this.restoreDeltaForChoice(choices[presetIndex]);
    }
    this.persistState();
    SV.refreshSidePanel();
  }

  private validSelectionIndexAfterPresetDelete(
    choices: ParameterTargetChoice[],
    previousIndex: number,
  ): number {
    if (choices.length === 0) {
      return 0;
    }
    if (previousIndex >= 0 && previousIndex < choices.length) {
      return previousIndex;
    }
    return choices.length - 1;
  }

  private loadStoredState(): void {
    if (!this.presetStore.available) {
      return;
    }
    const store = this.presetStore.load();
    if (store.presets.length > 0) {
      this.presets = store.presets;
      this.nextPresetId = this.nextAvailablePresetId();
    }
    this.restoreSettings(store.settings);
  }

  private restoreSettings(settings: ParameterControlSettings | undefined): void {
    if (!settings) {
      return;
    }

    this.loadingStoredState = true;
    this.copyDeltaByTarget(settings.deltaByTarget);
    this.copyControlWrites(settings.controlWrites);
    const choices = this.targetChoices();
    this.normalizeStoredDeltas(choices);
    const selectedIndex = this.storedTargetIndex(choices, settings.selectedTargetKey);
    this.setParameterIndex(selectedIndex);
    this.lastParameterIndex = selectedIndex;
    this.restoreDeltaForChoice(choices[selectedIndex]);
    this.easing.setValue(settings.easingAmount ?? 0);
    this.easingLeft.setValue(settings.easingLeft ?? true);
    this.easingRight.setValue(settings.easingRight ?? true);
    this.easingPlacement.setValue(settings.easingPlacement === "inside" ? 1 : 0);
    this.loadingStoredState = false;
  }

  private copyDeltaByTarget(values: TargetStoredValues | undefined): void {
    if (!values) {
      return;
    }
    for (const key in values) {
      const value = values[key];
      if (Number.isFinite(value)) {
        this.deltaByTarget[key] = value;
      }
    }
  }

  private copyControlWrites(
    values: { [typeName: string]: AutomationInterval[] } | undefined,
  ): void {
    if (!values) {
      return;
    }
    for (const typeName in values) {
      const records = values[typeName];
      if (!records) {
        continue;
      }
      this.controlWrites[typeName] = records.map((record) => ({
        start: Math.min(record.start, record.end),
        end: Math.max(record.start, record.end),
      }));
    }
  }

  private normalizeStoredDeltas(choices: ParameterTargetChoice[]): void {
    for (let index = 0; index < choices.length; index += 1) {
      const choice = choices[index];
      const key = targetValueKey(choice);
      if (!key) {
        continue;
      }
      const value = this.deltaByTarget[key];
      if (Number.isFinite(value)) {
        this.deltaByTarget[key] = this.normalizeDeltaValue(choice, value);
      }
    }
  }

  private storedTargetIndex(
    choices: ParameterTargetChoice[],
    selectedTargetKey: string | undefined,
  ): number {
    if (selectedTargetKey) {
      for (let index = 0; index < choices.length; index += 1) {
        if (targetValueKey(choices[index]) === selectedTargetKey) {
          return index;
        }
      }
    }
    return this.parameterIndex(choices);
  }

  private persistState(choices = this.targetChoices()): void {
    if (this.loadingStoredState) {
      return;
    }
    if (!this.presetStore.available) {
      debugLog("Define Preset: preset store unavailable");
      return;
    }
    this.normalizeStoredDeltas(choices);
    this.saveDeltaForIndex(choices, this.lastParameterIndex);
    debugLog(`Define Preset: writing presets to ${String(this.presetStore.path)}`);
    if (this.presetStore.save(this.presets, this.currentSettings(choices))) {
      debugLog("Define Preset: preset store write ok");
      return;
    }
    debugLog("Define Preset: preset store write failed");
    if (!this.presetStoreWarningShown) {
      this.presetStoreWarningShown = true;
      this.showMessage(`Could not save presets to ${PRESET_STORE_FILE_NAME}.`);
    }
  }

  private currentSettings(choices: ParameterTargetChoice[]): ParameterControlSettings {
    return {
      selectedTargetKey: targetValueKey(choices[this.lastParameterIndex]),
      deltaByTarget: { ...this.deltaByTarget },
      easingAmount: this.clamp(Number(this.easing.getValue()) || 0, [0, 100]),
      easingPlacement: resolveEasingPlacement(this.easingPlacement.getValue(), 0),
      easingLeft: this.easingLeft.getValue() !== false,
      easingRight: this.easingRight.getValue() !== false,
      controlWrites: this.controlWritesSnapshot(),
    };
  }

  private controlWritesSnapshot(): { [typeName: string]: AutomationInterval[] } {
    const result: { [typeName: string]: AutomationInterval[] } = {};
    for (const typeName in this.controlWrites) {
      result[typeName] = this.controlWrites[typeName].map((record) => ({
        start: record.start,
        end: record.end,
      }));
    }
    return result;
  }

  private nextAvailablePresetId(): number {
    let id = this.presets.length + 1;
    while (this.hasPresetId(`preset-${id}`)) {
      id += 1;
    }
    return id;
  }

  private hasPresetId(presetId: string): boolean {
    for (let index = 0; index < this.presets.length; index += 1) {
      if (this.presets[index].id === presetId) {
        return true;
      }
    }
    return false;
  }

  private normalizePresetName(value: unknown, fallback: string): string {
    const trimmed = trimAsciiWhitespace(String(value ?? ""));
    return trimmed || fallback;
  }

  private contextSignature(): string {
    try {
      const reference = this.currentReference();
      return `${reference.getTarget().getUUID()}:${this.vocalModeNames().join(",")}`;
    } catch (_error) {
      return "";
    }
  }

  private watchContext(): void {
    const signature = this.contextSignature();
    if (signature !== this.lastContextSignature) {
      this.lastContextSignature = signature;
      this.ensureParameterIndex(this.targetChoices());
      SV.refreshSidePanel();
    }
    SV.setTimeout(CONTEXT_WATCH_INTERVAL, () => this.watchContext());
  }

  private registerSelectionRefreshCallbacks(): void {
    try {
      const selection = SV.getMainEditor().getSelection();
      selection.registerSelectionCallback(() => SV.refreshSidePanel());
      selection.registerClearCallback(() => SV.refreshSidePanel());
    } catch (_error) {
      // Selection callbacks are best-effort; getState still checks note selection directly.
    }
  }

  private hasSelectedNotes(): boolean {
    try {
      const selection = SV.getMainEditor().getSelection();
      if (typeof selection.hasSelectedNotes === "function") {
        return selection.hasSelectedNotes();
      }
      return selection.getSelectedNotes().length > 0;
    } catch (_error) {
      return false;
    }
  }

  private apply(): void {
    const editor = SV.getMainEditor();
    const selection = editor.getSelection();
    const notes = selection.getSelectedNotes();
    if (notes.length === 0) {
      this.showMessage("Select one or more notes first.");
      return;
    }

    const group = editor.getCurrentGroup().getTarget();
    const target = this.currentTarget();
    const delta = Number(this.delta.getValue()) || 0;
    const easing = this.currentEasingOptions();

    SV.getProject().newUndoRecord();
    if (isPresetChoice(target)) {
      this.applyPreset(group, notes, target.presetId ?? "", delta, easing);
    } else if (this.isParameterChoice(target)) {
      this.applyParameter(group, notes, target, delta, easing);
    }
  }

  private applyPreset(
    group: NoteGroup,
    notes: Note[],
    presetId: string,
    deltaPercent: number,
    easing: EasingOptions,
  ): void {
    const preset = this.presetById(presetId);
    if (!preset) {
      this.showMessage("Preset not found.");
      return;
    }

    resolvePresetDeltas(preset, deltaPercent).forEach((entryDelta) => {
      const fallbackRange = this.presetEntryRange(preset, entryDelta.typeName);
      this.applyParameterDelta(
        group,
        notes,
        entryDelta.typeName,
        entryDelta.delta,
        fallbackRange,
        easing,
      );
    });
  }

  private applyParameter(
    group: NoteGroup,
    notes: Note[],
    choice: ParameterChoice,
    delta: number,
    easing: EasingOptions,
  ): void {
    const fallbackRange: [number, number] = [choice.min, choice.max];
    this.applyParameterDelta(
      group,
      notes,
      this.parameterTypeName(choice),
      delta,
      fallbackRange,
      easing,
    );
  }

  private applyParameterDelta(
    group: NoteGroup,
    notes: Note[],
    typeName: string,
    delta: number,
    fallbackRange: [number, number],
    easing: EasingOptions,
  ): void {
    try {
      const automation = group.getParameter(typeName);
      const definition = automation.getDefinition();
      const range = definition.range ?? fallbackRange;
      const edits = this.collectEdits(automation, notes, easing, delta);
      edits.forEach((edit) => {
        this.applyEdit(automation, edit, delta, range);
      });
      this.recordControlWrites(typeName, edits);
    } catch (_error) {
      this.showMessage(`Failed to apply ${typeName}.`);
    }
  }

  private extractPresetEntries(group: NoteGroup, notes: Note[]): ParameterPresetEntry[] {
    const intervals = this.quantizedNoteIntervals(notes);
    const choices = extractPresetTargetChoices(this.availableParameterChoices());
    return extractedPresetEntriesFromSamples(
      choices.map((choice) => {
        const typeName = this.parameterTypeName(choice);
        const fallbackRange: [number, number] = [choice.min, choice.max];
        return this.extractSampleForChoice(group, intervals, choice, typeName, fallbackRange);
      }),
    );
  }

  private extractSampleForChoice(
    group: NoteGroup,
    intervals: Array<[Blick, Blick]>,
    choice: ParameterChoice,
    typeName: string,
    fallbackRange: [number, number],
  ): {
    label: string;
    typeName: string;
    values: number[];
    defaultValue: number;
    source: PresetExtractionSource;
    min?: number;
    max?: number;
  } {
    try {
      const automation = group.getParameter(typeName);
      const definition = automation.getDefinition();
      const range = definition.range ?? fallbackRange;
      const values: number[] = [];
      let hasControl = false;
      intervals.forEach((interval) => {
        debugLog(
          `Extract Preset: probing ${typeName} ${String(interval[0])}-${String(interval[1])}`,
        );
        const points = automation.getPoints(interval[0], interval[1]);
        if (this.hasControlWrite(typeName, interval)) {
          hasControl = true;
        }
        if (!hasControl && points.length === 0) {
          return;
        }
        this.sampleTimes(interval, points).forEach((time) => {
          values.push(automation.get(time));
        });
      });
      return {
        label: choice.label,
        typeName,
        values,
        defaultValue:
          typeof definition.defaultValue === "number" && Number.isFinite(definition.defaultValue)
            ? definition.defaultValue
            : 0,
        source: hasControl || values.length > 0 ? (hasControl ? "control" : "graph") : "unknown",
        min: range[0],
        max: range[1],
      };
    } catch (_error) {
      return {
        label: choice.label,
        typeName,
        values: [],
        defaultValue: 0,
        source: "unknown",
        min: choice.min,
        max: choice.max,
      };
    }
  }

  private presetEntryRange(preset: ParameterPreset, typeName: string): [number, number] {
    for (let index = 0; index < preset.entries.length; index += 1) {
      const entry = preset.entries[index];
      if (entry.typeName === typeName) {
        return [entry.min ?? -1, entry.max ?? 1];
      }
    }
    return [-1, 1];
  }

  private presetById(presetId: string): ParameterPreset | undefined {
    for (let index = 0; index < this.presets.length; index += 1) {
      const preset = this.presets[index];
      if (preset.id === presetId) {
        return preset;
      }
    }
    return undefined;
  }

  private currentEasingOptions(): EasingOptions {
    return {
      percent: this.clamp(Number(this.easing.getValue()) || 0, [0, 100]),
      placement: resolveEasingPlacement(this.easingPlacement.getValue(), 0),
      left: this.easingLeft.getValue() !== false,
      right: this.easingRight.getValue() !== false,
    };
  }

  private parameterTypeName(choice: ParameterChoice): string {
    return choice.typeName;
  }

  private choiceForType(typeName: string): ParameterChoice | undefined {
    const choices = this.availableParameterChoices();
    for (let index = 0; index < choices.length; index += 1) {
      if (choices[index].typeName === typeName) {
        return choices[index];
      }
    }
    return undefined;
  }

  private choiceStep(typeName: string): number {
    const choice = this.choiceForType(typeName);
    return choice ? choice.step : 0.01;
  }

  private choiceFormat(typeName: string): string {
    const choice = this.choiceForType(typeName);
    return choice ? choice.format : "%1.2f";
  }

  private deltaLimit(choice: ParameterChoice): number {
    return Math.max(Math.abs(choice.min), Math.abs(choice.max));
  }

  private normalizeDeltaValue(choice: ParameterTargetChoice | undefined, value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    if (!choice || isDefinePresetChoice(choice)) {
      return value;
    }

    if (isPresetChoice(choice)) {
      return this.clamp(value, [PRESET_DELTA_CHOICE.min, PRESET_DELTA_CHOICE.max]);
    }

    if (!this.isParameterChoice(choice)) {
      return value;
    }

    const limit = this.deltaLimit(choice);
    if (limit <= 0) {
      return 0;
    }

    let normalizedValue = value;
    if (Math.abs(value) > limit && Math.abs(value) <= 200) {
      normalizedValue = (value / 100) * limit;
    }
    return this.clamp(normalizedValue, [-limit, limit]);
  }

  private collectEdits(
    automation: Automation,
    notes: Note[],
    easing: EasingOptions,
    delta: number,
  ): AutomationEdit[] {
    return resolveEasingEnvelopes(
      this.mergeRanges(notes).map((range) => ({ start: range[0], end: range[1] })),
      easing,
    ).map((envelope) => {
      const restoreBefore = Math.max(0, envelope.removeStart - RESTORE_OFFSET);
      const restoreAfter = envelope.removeEnd + RESTORE_OFFSET;
      return {
        removeStart: envelope.removeStart,
        removeEnd: envelope.removeEnd,
        restoreBefore,
        restoreAfter,
        restoreBeforeValue: automation.get(restoreBefore),
        restoreAfterValue: automation.get(restoreAfter),
        points: this.collectWeightedPoints(
          automation,
          envelope.points as Array<[Blick, number]>,
          automation.getPoints(envelope.removeStart, envelope.removeEnd),
          delta,
        ),
      };
    });
  }

  private mergeRanges(notes: Note[]): Array<[Blick, Blick]> {
    return this.mergeIntervals(
      notes.map((note) => [note.getOnset(), note.getEnd()] as [Blick, Blick]),
    );
  }

  private quantizedNoteIntervals(notes: Note[]): Array<[Blick, Blick]> {
    return this.mergeIntervals(
      notes.map((note) => {
        const onset = note.getOnset();
        const end = note.getEnd();
        const snappedOnset = this.snapTime(onset);
        const snappedEnd = this.snapTime(end);
        if (snappedOnset === snappedEnd) {
          return [Math.min(onset, end), Math.max(onset, end)] as [Blick, Blick];
        }
        return [Math.min(snappedOnset, snappedEnd), Math.max(snappedOnset, snappedEnd)] as [
          Blick,
          Blick,
        ];
      }),
    );
  }

  private mergeIntervals(intervals: Array<[Blick, Blick]>): Array<[Blick, Blick]> {
    const ranges = intervals
      .map(
        (interval) =>
          [Math.min(interval[0], interval[1]), Math.max(interval[0], interval[1])] as [
            Blick,
            Blick,
          ],
      )
      .sort((a, b) => a[0] - b[0]);
    const merged: Array<[Blick, Blick]> = [];

    ranges.forEach((range) => {
      const previous = merged[merged.length - 1];
      if (!previous || range[0] > previous[1] + RESTORE_OFFSET * 2) {
        merged.push([range[0], range[1]]);
        return;
      }
      previous[1] = Math.max(previous[1], range[1]);
    });

    return merged;
  }

  private snapTime(time: Blick): Blick {
    try {
      return SV.getMainEditor().getNavigation().snap(time);
    } catch (_error) {
      return time;
    }
  }

  private sampleTimes(interval: [Blick, Blick], points: Array<[Blick, number]>): Blick[] {
    const times: Blick[] = [];
    this.addSampleTime(times, interval[0]);
    this.addSampleTime(times, interval[0] + (interval[1] - interval[0]) / 2);
    this.addSampleTime(times, interval[1]);
    points.forEach((point) => {
      this.addSampleTime(times, point[0]);
    });
    return times.sort((left, right) => left - right);
  }

  private addSampleTime(times: Blick[], time: Blick): void {
    if (!Number.isFinite(time)) {
      return;
    }
    for (let index = 0; index < times.length; index += 1) {
      if (Math.abs(times[index] - time) < 0.000001) {
        return;
      }
    }
    times.push(time);
  }

  private recordControlWrites(typeName: string, edits: AutomationEdit[]): void {
    if (!this.controlWrites[typeName]) {
      this.controlWrites[typeName] = [];
    }
    edits.forEach((edit) => {
      this.controlWrites[typeName].push({ start: edit.removeStart, end: edit.removeEnd });
    });
    this.controlWrites[typeName] = this.mergeIntervals(
      this.controlWrites[typeName].map((record) => [record.start, record.end] as [Blick, Blick]),
    ).map((interval) => ({ start: interval[0], end: interval[1] }));
    this.persistState();
  }

  private hasControlWrite(typeName: string, interval: [Blick, Blick]): boolean {
    const records = this.controlWrites[typeName];
    if (!records) {
      return false;
    }
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.start <= interval[1] && record.end >= interval[0]) {
        return true;
      }
    }
    return false;
  }

  private applyEdit(
    automation: Automation,
    edit: AutomationEdit,
    delta: number,
    range: [number, number],
  ): void {
    automation.remove(edit.removeStart, edit.removeEnd);
    if (edit.restoreBefore < edit.removeStart) {
      automation.add(edit.restoreBefore, edit.restoreBeforeValue);
    }
    edit.points.forEach((point) => {
      automation.add(
        point.time,
        this.clamp(composeEasedAutomationValue(point.value, delta, point.multiplier), range),
      );
    });
    automation.add(edit.restoreAfter, edit.restoreAfterValue);
  }

  private collectWeightedPoints(
    automation: Automation,
    envelopePoints: Array<[Blick, number]>,
    existingPoints: Array<[Blick, number]>,
    delta: number,
  ): WeightedAutomationPoint[] {
    const points: WeightedAutomationPoint[] = [];
    envelopePoints.forEach((point) => {
      points.push({
        time: point[0],
        value: automation.get(point[0]),
        multiplier: point[1],
      });
    });

    existingPoints.forEach((point) => {
      if (!this.hasEnvelopePoint(envelopePoints, point[0])) {
        points.push({
          time: point[0],
          value: point[1],
          multiplier: easingMultiplierAt(point[0], envelopePoints),
        });
      }
    });

    easedAutomationIntersectionTimes(
      this.weightedPointValues(points),
      envelopePoints,
      delta,
    ).forEach((time) => {
      if (!this.hasWeightedPoint(points, time)) {
        points.push({
          time,
          value: automation.get(time),
          multiplier: easingMultiplierAt(time, envelopePoints),
        });
      }
    });

    return points.sort((left, right) => left.time - right.time);
  }

  private weightedPointValues(points: WeightedAutomationPoint[]): Array<[Blick, number]> {
    return points
      .map((point) => [point.time, point.value] as [Blick, number])
      .sort((left, right) => left[0] - right[0]);
  }

  private hasWeightedPoint(points: WeightedAutomationPoint[], time: Blick): boolean {
    for (let index = 0; index < points.length; index += 1) {
      if (points[index].time === time) {
        return true;
      }
    }
    return false;
  }

  private hasEnvelopePoint(points: Array<[Blick, number]>, time: Blick): boolean {
    for (let index = 0; index < points.length; index += 1) {
      if (points[index][0] === time) {
        return true;
      }
    }
    return false;
  }

  private clamp(value: number, range: [number, number]): number {
    return Math.min(range[1], Math.max(range[0], value));
  }
}

function createPresetFileStore(): PresetFileStore {
  const path = presetStorePath();
  if (!path || typeof io === "undefined") {
    return {
      available: false,
      load: () => ({ version: 1, presets: [] }),
      save: () => false,
    };
  }

  return {
    available: true,
    path,
    load: () => readPresetFile(path),
    save: (presets, settings) => writePresetFile(path, presets, settings),
  };
}

function presetStorePath(): string | undefined {
  return scriptSiblingPath(PRESET_STORE_FILE_NAME);
}

function debugLog(message: string): void {
  try {
    if (typeof io === "undefined") {
      return;
    }
    const path = scriptSiblingPath(DEBUG_LOG_FILE_NAME);
    if (!path) {
      return;
    }
    const file = io.open(path, "a");
    if (!file) {
      return;
    }
    file.write(`${message}\n`);
    file.close();
  } catch (_error) {
    // Keep diagnostics best-effort; logging must never break the script.
  }
}

function dialogResultStatus(result: SVDialogResult | undefined): unknown {
  if (isRecord(result)) {
    return result.status;
  }
  return result;
}

function dialogResultAnswers(result: SVDialogResult | undefined): { [name: string]: unknown } {
  const maybeResult = result as unknown;
  if (isRecord(maybeResult) && isRecord(maybeResult.answers)) {
    return maybeResult.answers;
  }
  if (isRecord(maybeResult)) {
    return maybeResult;
  }
  return {};
}

function describeDialogResult(
  result: SVDialogResult | undefined,
  answers: { [name: string]: unknown },
): string {
  return `result keys=${recordKeySummary(result as unknown)}; answer keys=${recordKeySummary(answers)}`;
}

function recordKeySummary(value: unknown): string {
  if (!isRecord(value)) {
    return "none";
  }

  const keys: string[] = [];
  for (const key in value) {
    if (keys.length >= 12) {
      keys.push("...");
      break;
    }
    keys.push(key);
  }
  return keys.length > 0 ? keys.join(",") : "empty";
}

function isRecord(value: unknown): value is { [name: string]: unknown } {
  return !!value && typeof value === "object";
}

function scriptSiblingPath(fileName: string): string | undefined {
  const scriptPath = currentScriptPath();
  if (scriptPath) {
    const separatorIndex = lastPathSeparatorIndex(scriptPath);
    if (separatorIndex >= 0) {
      return `${scriptPath.substring(0, separatorIndex + 1)}${fileName}`;
    }
  }
  return defaultScriptSiblingPath(fileName);
}

function lastPathSeparatorIndex(path: string): number {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const char = path.charAt(index);
    if (char === "/" || char === "\\") {
      return index;
    }
  }
  return -1;
}

function currentScriptPath(): string | undefined {
  if (typeof debug === "undefined") {
    return undefined;
  }

  for (let level = 1; level <= 12; level += 1) {
    try {
      const info = debug.getinfo(level, "S");
      if (info && typeof info.source === "string") {
        const source = info.source.charAt(0) === "@" ? info.source.substring(1) : info.source;
        if (isAbsolutePath(source)) {
          return source;
        }
      }
    } catch (_error) {
      return undefined;
    }
  }
  return undefined;
}

function isAbsolutePath(path: string): boolean {
  if (path.charAt(0) === "/") {
    return true;
  }
  if (path.length >= 3 && path.charAt(1) === ":" && path.charAt(2) === "\\") {
    return true;
  }
  return false;
}

function defaultScriptSiblingPath(fileName: string): string | undefined {
  const home = envValue("HOME");
  if (home) {
    return `${home}/Library/Application Support/Dreamtonics/Synthesizer V Studio 2/scripts/${fileName}`;
  }

  const userProfile = envValue("USERPROFILE");
  if (userProfile) {
    return `${userProfile}\\AppData\\Roaming\\Dreamtonics\\Synthesizer V Studio 2\\scripts\\${fileName}`;
  }
  return undefined;
}

function envValue(name: string): string | undefined {
  try {
    if (typeof os === "undefined") {
      return undefined;
    }
    const value = os.getenv(name);
    return value || undefined;
  } catch (_error) {
    return undefined;
  }
}

function readPresetFile(path: string): ParameterPresetStore {
  try {
    if (typeof io === "undefined") {
      return { version: 1, presets: [] };
    }
    const file = io.open(path, "r");
    if (!file) {
      return { version: 1, presets: [] };
    }
    const text = file.read("*a");
    file.close();
    return parseParameterControlStore(String(text || ""));
  } catch (_error) {
    return { version: 1, presets: [] };
  }
}

function writePresetFile(
  path: string,
  presets: ParameterPreset[],
  settings: ParameterControlSettings,
): boolean {
  try {
    if (typeof io === "undefined") {
      return false;
    }
    const file = io.open(path, "w");
    if (!file) {
      return false;
    }
    file.write(serializeParameterControlStore(presets, settings));
    file.close();
    return true;
  } catch (_error) {
    return false;
  }
}

const panel = new ParameterControlPanel();

globalThis.getClientInfo = getClientInfoFactory(SCRIPT_TITLE, {
  minEditorVersion: 131330,
  type: "SidePanelSection",
});
globalThis.getSidePanelSectionState = () => panel.getState();
