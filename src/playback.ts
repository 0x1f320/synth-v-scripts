import { getClientInfoFactory } from "@/common/client-info";
import { median } from "@/common/median";
import { button } from "@/ui/button";
import { checkbox } from "@/ui/checkbox";
import { label } from "@/ui/label";
import { row } from "@/ui/row";

interface NoteTrack {
  index: number;
  name: string;
}

const SCRIPT_TITLE = "Advanced Playback";

const CONFIG = {
  viewPosition: 0.25,
  followArrangement: false,
  skipInstrumental: true,
  pollInterval: 15,
  trackWatchInterval: 500,
  pitchLookBehind: 1,
  pitchLookAhead: 5,
  easeDurationMs: 250,
};

class FollowPlayheadPanel {
  private running = false;
  private editor: MainEditorView | null = null;
  private mainNav: CoordinateSystem | null = null;
  private arrNav: CoordinateSystem | null = null;
  private lastTrackIdx = -1;
  private lastGroupIdx = -1;
  private lastSignature = "";

  private readonly trackChecks: { [index: number]: WidgetValue } = {};
  private readonly startButton = SV.create("WidgetValue");
  private readonly allButton = SV.create("WidgetValue");
  private readonly noneButton = SV.create("WidgetValue");
  private readonly trackHorizontal = this.reactive(true);
  private readonly trackVertical = this.reactive(true);
  private readonly easeDuration = this.reactive(CONFIG.easeDurationMs);
  private readonly viewPos = this.reactive(CONFIG.viewPosition);
  private readonly trackFocusEnabled = this.reactive(true, () => SV.refreshSidePanel());

  constructor() {
    this.startButton.setValueChangeCallback(() => this.toggleRunning());
    this.allButton.setValueChangeCallback(() => this.setAll(true));
    this.noneButton.setValueChangeCallback(() => this.setAll(false));

    this.lastSignature = this.signature();
    this.watchTracks();
  }

  getState(): SVSidePanelState {
    const tracks = this.noteTracks();
    this.ensureChecks(tracks);

    const rows: SVPanelRow[] = [
      label("Scroll Following"),
      row([checkbox("Track Horizontally", this.trackHorizontal)]),
      row([checkbox("Track Vertically", this.trackVertical)]),
      row([
        {
          type: "Slider",
          text: "Vertical Scroll Duration (ms)",
          format: "%1.0f",
          minValue: 50,
          maxValue: 1000,
          interval: 50,
          value: this.easeDuration,
          width: 1,
        },
      ]),
      label("Track Focusing"),
      row([checkbox("Enabled", this.trackFocusEnabled)]),
    ];

    if (this.trackFocusEnabled.getValue()) {
      if (tracks.length === 0) {
        rows.push(label("(no note tracks)"));
      } else {
        tracks.forEach((track) => {
          rows.push(row([checkbox(track.name, this.trackChecks[track.index])]));
        });
      }
      rows.push(row([button("All", this.allButton, 0.5), button("None", this.noneButton, 0.5)]));
    }

    rows.push(label("Playhead Position"));
    rows.push(
      row([
        {
          type: "Slider",
          text: "Position",
          format: "%1.2f",
          minValue: 0.05,
          maxValue: 0.95,
          interval: 0.05,
          value: this.viewPos,
          width: 1,
        },
      ]),
    );
    rows.push(row([button(this.running ? "Pause" : "Play", this.startButton, 1)]));

    return { title: SCRIPT_TITLE, rows };
  }

  private reactive(initial: number | boolean, onChange?: () => void): WidgetValue {
    const widget = SV.create("WidgetValue");
    widget.setValue(initial);
    widget.setValueChangeCallback(onChange ?? (() => this.reapplyOnce()));
    return widget;
  }

  private isNoteTrack(track: Track): boolean {
    for (let g = 0; g < track.getNumGroups(); g++) {
      if (!track.getGroupReference(g).isInstrumental()) {
        return true;
      }
    }
    return false;
  }

  private noteTracks(): NoteTrack[] {
    const project = SV.getProject();
    const tracks: NoteTrack[] = [];
    for (let t = 0; t < project.getNumTracks(); t++) {
      const track = project.getTrack(t);
      if (this.isNoteTrack(track)) {
        tracks.push({ index: t, name: track.getName() });
      }
    }
    return tracks;
  }

  private ensureChecks(tracks: NoteTrack[]): void {
    tracks.forEach((track) => {
      if (!this.trackChecks[track.index]) {
        const widget = SV.create("WidgetValue");
        widget.setValue(true);
        this.trackChecks[track.index] = widget;
      }
    });
  }

  private signature(): string {
    return this.noteTracks()
      .map((track) => `${track.index}:${track.name}`)
      .join(",");
  }

  private watchTracks(): void {
    const sig = this.signature();
    if (sig !== this.lastSignature) {
      this.lastSignature = sig;
      SV.refreshSidePanel();
    }
    SV.setTimeout(CONFIG.trackWatchInterval, () => this.watchTracks());
  }

  private setAll(checked: boolean): void {
    const tracks = this.noteTracks();
    this.ensureChecks(tracks);
    tracks.forEach((track) => {
      this.trackChecks[track.index].setValue(checked);
    });
    SV.refreshSidePanel();
  }

  private toggleRunning(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  private start(): void {
    this.editor = SV.getMainEditor();
    this.mainNav = this.editor.getNavigation();
    this.arrNav = CONFIG.followArrangement ? SV.getArrangement().getNavigation() : null;
    this.lastTrackIdx = -1;
    this.lastGroupIdx = -1;
    this.running = true;

    SV.getPlayback().play();
    this.loop();
    SV.refreshSidePanel();
  }

  private pause(): void {
    this.running = false;
    SV.getPlayback().pause();
    SV.refreshSidePanel();
  }

  private loop(): void {
    if (!this.running) {
      return;
    }
    this.tick();
    if (this.running) {
      SV.setTimeout(CONFIG.pollInterval, () => this.loop());
    }
  }

  private tick(): void {
    const playback = SV.getPlayback();
    if (playback.getStatus() === "stopped") {
      this.running = false;
      SV.refreshSidePanel();
      return;
    }
    this.applyFollow(this.playheadPosition());
  }

  private reapplyOnce(): void {
    if (this.mainNav) {
      this.applyFollow(this.playheadPosition());
    }
  }

  private playheadPosition(): Blick {
    return SV.getProject().getTimeAxis().getBlickFromSeconds(SV.getPlayback().getPlayhead());
  }

  private applyFollow(position: Blick): void {
    const nav = this.mainNav;
    if (!nav) {
      return;
    }

    const ref = this.followGroup(position);

    if (this.trackHorizontal.getValue()) {
      this.followTime(nav, position);
      if (this.arrNav) {
        this.followTime(this.arrNav, position);
      }
    }
    if (this.trackVertical.getValue() && ref) {
      this.followPitch(nav, ref, position);
    }
  }

  private followTime(coord: CoordinateSystem, position: Blick): void {
    const range = coord.getTimeViewRange();
    const pos = this.viewPos.getValue();
    coord.setTimeRight(position + (range[1] - range[0]) * (1 - pos));
  }

  private followPitch(nav: CoordinateSystem, ref: NoteGroupReference, position: Blick): void {
    const group = ref.getTarget();
    const localPos = position - ref.getTimeOffset();
    const numNotes = group.getNumNotes();
    if (numNotes === 0) {
      return;
    }

    let curIdx = -1;
    for (let i = 0; i < numNotes; i++) {
      const note = group.getNote(i);
      if (note.getOnset() > localPos) {
        break;
      }
      curIdx = i;
      if (localPos < note.getEnd()) {
        break;
      }
    }
    if (curIdx < 0) {
      return;
    }

    const lo = Math.max(0, curIdx - CONFIG.pitchLookBehind);
    const hi = Math.min(numNotes - 1, curIdx + CONFIG.pitchLookAhead);
    const pitches: number[] = [];
    for (let j = lo; j <= hi; j++) {
      pitches.push(group.getNote(j).getPitch());
    }

    const range = nav.getValueViewRange();
    const center = (range[0] + range[1]) / 2;
    const duration = this.easeDuration.getValue();
    const alpha = duration <= 0 ? 1 : 1 - Math.exp(-CONFIG.pollInterval / duration);
    nav.setValueCenter(center + (median(pitches) - center) * alpha);
  }

  private followGroup(position: Blick): NoteGroupReference | null {
    const project = SV.getProject();

    let bestTrack: Track | null = null;
    let bestRef: NoteGroupReference | null = null;
    let bestOnset = -1;
    let bestTrackIdx = -1;
    let bestGroupIdx = -1;

    for (let t = 0; t < project.getNumTracks(); t++) {
      if (!this.trackChecks[t]?.getValue()) {
        continue;
      }
      const track = project.getTrack(t);
      for (let g = 0; g < track.getNumGroups(); g++) {
        const ref = track.getGroupReference(g);
        if (CONFIG.skipInstrumental && ref.isInstrumental()) {
          continue;
        }
        const onset = ref.getOnset();
        if (position >= onset && position < ref.getEnd() && onset > bestOnset) {
          bestOnset = onset;
          bestTrack = track;
          bestRef = ref;
          bestTrackIdx = t;
          bestGroupIdx = g;
        }
      }
    }

    if (!bestRef || !bestTrack) {
      return null;
    }
    if (!this.trackFocusEnabled.getValue()) {
      return bestRef;
    }
    if (bestTrackIdx === this.lastTrackIdx && bestGroupIdx === this.lastGroupIdx) {
      return bestRef;
    }

    this.lastTrackIdx = bestTrackIdx;
    this.lastGroupIdx = bestGroupIdx;
    this.editor?.setCurrentTrack(bestTrack);
    this.editor?.setCurrentGroup(bestRef);
    return bestRef;
  }
}

const panel = new FollowPlayheadPanel();

globalThis.getClientInfo = getClientInfoFactory(SCRIPT_TITLE, {
  minEditorVersion: 131330,
  type: "SidePanelSection",
});
globalThis.getSidePanelSectionState = () => panel.getState();
