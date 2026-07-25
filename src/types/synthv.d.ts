type Blick = number;

interface SVClientInfo {
  name: string;
  category?: string;
  author?: string;
  versionNumber?: number;
  minEditorVersion?: number;
  type?: string;
}

interface WidgetValue {
  getValue(): any;
  setValue(value: any): void;
  getEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  setValueChangeCallback(callback: () => void): void;
}

interface CoordinateSystem {
  getTimeViewRange(): [Blick, Blick];
  getValueViewRange(): [number, number];
  getTimePxPerUnit(): number;
  getValuePxPerUnit(): number;
  setTimeLeft(t: Blick): void;
  setTimeRight(t: Blick): void;
  setTimeScale(scale: number): void;
  setValueCenter(v: number): void;
  snap(t: Blick): Blick;
  t2x(t: Blick): number;
  x2t(x: number): Blick;
  v2y(v: number): number;
  y2v(y: number): number;
  getParent(): unknown;
}

interface Note {
  getOnset(): Blick;
  getEnd(): Blick;
  getDuration(): Blick;
  setTimeRange(onset: Blick, duration: Blick): void;
  setOnset(onset: Blick): void;
  setDuration(duration: Blick): void;
  getPitch(): number;
  setPitch(pitch: number): void;
  getDetune(): number;
  setDetune(detune: number): void;
  getLyrics(): string;
  setLyrics(lyrics: string): void;
  getPhonemes(): string;
  setPhonemes(phonemes: string): void;
  getIndexInParent(): number;
  clone(): Note;
  [key: string]: any;
}

interface Automation {
  get(b: Blick): number;
  add(b: Blick, value: number): void;
  remove(from: Blick, to: Blick): void;
  getPoints(from: Blick, to: Blick): Array<[Blick, number]>;
  getDefinition(): { defaultValue: number; [key: string]: any };
  [key: string]: any;
}

interface NoteGroup {
  getName(): string;
  setName(name: string): void;
  getNumNotes(): number;
  getNote(index: number): Note;
  addNote(note: Note): number;
  removeNote(index: number): void;
  getParameter(type: string): Automation;
  getUUID(): string;
  getIndexInParent(): number;
  clone(): NoteGroup;
  [key: string]: any;
}

interface NoteGroupReference {
  getTarget(): NoteGroup;
  setTarget(group: NoteGroup): void;
  getOnset(): Blick;
  getEnd(): Blick;
  getDuration(): Blick;
  getTimeOffset(): Blick;
  setTimeOffset(offset: Blick): void;
  getPitchOffset(): number;
  setPitchOffset(semitones: number): void;
  isInstrumental(): boolean;
  isMain(): boolean;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  getVoice(): unknown;
  getIndexInParent(): number;
  getParent(): Track;
  clone(): NoteGroupReference;
  [key: string]: any;
}

interface Track {
  getName(): string;
  setName(name: string): void;
  getNumGroups(): number;
  getGroupReference(index: number): NoteGroupReference;
  addGroupReference(ref: NoteGroupReference): number;
  removeGroupReference(index: number): void;
  getDisplayColor(): string;
  getDisplayOrder(): number;
  getDuration(): Blick;
  getIndexInParent(): number;
  clone(): Track;
  [key: string]: any;
}

interface TimeAxis {
  getBlickFromSeconds(seconds: number): Blick;
  getSecondsFromBlick(b: Blick): number;
  addTempoMark(b: Blick, bpm: number): void;
  getAllTempoMarks(): unknown[];
  getAllMeasureMarks(): unknown[];
  [key: string]: any;
}

interface Project {
  getNumTracks(): number;
  getTrack(index: number): Track;
  addTrack(track: Track): number;
  removeTrack(index: number): void;
  getNoteGroup(index: number): NoteGroup;
  getNumNoteGroupsInLibrary(): number;
  addNoteGroup(group: NoteGroup, index?: number): number;
  removeNoteGroup(index: number): void;
  getTimeAxis(): TimeAxis;
  getDuration(): Blick;
  getFileName(): string;
  newUndoRecord(): void;
  [key: string]: any;
}

interface SelectionState {
  getSelectedNotes(): Note[];
  getSelectedGroups(): NoteGroupReference[];
  hasSelectedNotes(): boolean;
  hasSelectedContent(): boolean;
  clearAll(): void;
  selectNote(note: Note): void;
  registerSelectionCallback(callback: (type: string, selected: boolean) => void): void;
  registerClearCallback(callback: (type: string) => void): void;
  [key: string]: any;
}

interface MainEditorView {
  getNavigation(): CoordinateSystem;
  getSelection(): SelectionState;
  getCurrentGroup(): NoteGroupReference;
  setCurrentGroup(ref: NoteGroupReference): void;
  getCurrentTrack(): Track;
  setCurrentTrack(track: Track): void;
  getParent(): unknown;
}

interface Arrangement {
  getNavigation(): CoordinateSystem;
  [key: string]: any;
}

interface PlaybackControl {
  play(): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  loop(begin: number, end: number): void;
  getStatus(): "playing" | "looping" | "stopped";
  getPlayhead(): number;
}

interface HostInfo {
  hostName: string;
  hostVersion: string;
  hostVersionNumber: number;
  osType: string;
  languageCode: string;
  [key: string]: any;
}

interface SVDialogResult {
  status: boolean;
  answers: { [name: string]: any };
}

interface SVCustomDialogForm {
  title: string;
  message?: string;
  buttons?: string;
  widgets: Array<{ [key: string]: any }>;
}

interface SVPanelWidget {
  type: string;
  text?: string;
  value?: WidgetValue;
  width?: number;
  height?: number;
  format?: string;
  minValue?: number;
  maxValue?: number;
  interval?: number;
  choices?: string[];
}

interface SVPanelRow {
  type: "Label" | "Container";
  text?: string;
  columns?: SVPanelWidget[];
}

interface SVSidePanelState {
  title: string;
  rows: SVPanelRow[];
}

interface SVHost {
  readonly QUARTER: number;

  T(text: string): string;
  create(type: "WidgetValue"): WidgetValue;
  create(type: "Automation", paramType: string): Automation;
  create(type: string, ...args: any[]): any;
  finish(): void;

  getMainEditor(): MainEditorView;
  getProject(): Project;
  getPlayback(): PlaybackControl;
  getArrangement(): Arrangement;
  getHostInfo(): HostInfo;

  getHostClipboard(): string;
  setHostClipboard(text: string): void;

  showMessageBox(title: string, message: string): void;
  showCustomDialog(form: SVCustomDialogForm): SVDialogResult;
  showInputBox(title: string, message: string, defaultText: string): string;
  refreshSidePanel(): void;

  setTimeout(milliseconds: number, callback: () => void): void;

  blick2Quarter(b: Blick): number;
  quarter2Blick(q: number): Blick;
  blick2Seconds(b: Blick, bpm: number): number;
  seconds2Blick(s: number, bpm: number): Blick;
  freq2Pitch(frequency: number): number;
  pitch2Freq(pitch: number): number;

  [key: string]: any;
}

declare const SV: SVHost;

declare var getClientInfo: () => SVClientInfo;
declare var main: () => void;
declare var getSidePanelSectionState: () => SVSidePanelState;
declare var getTranslations: (langCode: string) => Array<[string, string]>;
