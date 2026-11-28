import { button } from "@/ui/button";
import { label } from "@/ui/label";
import { row } from "@/ui/row";
import type { NoteFeature } from "../feature";
import { hasSelectedNotes, showMessage } from "../host";
import {
  interpolatePitch,
  mergeRanges,
  type PitchSample,
  sampleTimes,
  splitCurve,
  type TimeRange,
} from "../pitch-line";

const DEFAULT_INTERVAL_MS = 50;

interface CurvePlan {
  curve: PitchControlCurve;
  anchorPitch: number;
  samples: PitchSample[];
  converted: TimeRange[];
  remainders: PitchSample[][];
}

function isCurve(control: PitchControlPoint | PitchControlCurve): control is PitchControlCurve {
  return typeof control.getPoints === "function";
}

function absoluteSamples(curve: PitchControlCurve): PitchSample[] {
  const position = curve.getPosition();
  const pitch = curve.getPitch();
  return curve
    .getPoints()
    .map(([time, value]): PitchSample => [position + time, pitch + value])
    .sort((a, b) => a[0] - b[0]);
}

/** Converts manual pitch lines under the selected notes into pitch points every N ms. */
export class PitchLineToPoints implements NoteFeature {
  readonly label = "Pitch Line to Points";
  private readonly intervalMs = SV.create("WidgetValue");
  private readonly convertButton = SV.create("WidgetValue");

  constructor(private readonly title: string) {
    this.intervalMs.setValue(DEFAULT_INTERVAL_MS);
    this.convertButton.setValueChangeCallback(() => this.convert());
  }

  rows(): SVPanelRow[] {
    this.convertButton.setEnabled(hasSelectedNotes());
    return [
      label("Manual pitch lines under the selected notes become pitch points."),
      row([
        {
          type: "Slider",
          text: "Interval",
          format: "%1.0f ms",
          minValue: 10,
          maxValue: 500,
          interval: 5,
          value: this.intervalMs,
          width: 1,
        },
      ]),
      row([button("Convert", this.convertButton, 1)]),
    ];
  }

  private convert(): void {
    const editor = SV.getMainEditor();
    const notes = editor.getSelection().getSelectedNotes();
    if (notes.length === 0) {
      showMessage(this.title, "Select one or more notes first.");
      return;
    }

    const reference = editor.getCurrentGroup();
    const group = reference.getTarget();
    const ranges = mergeRanges(
      notes.map((note) => ({ start: note.getOnset(), end: note.getEnd() })),
    );
    const plans = this.planCurves(group, ranges);
    if (plans.length === 0) {
      showMessage(this.title, "No manual pitch lines overlap the selected notes.");
      return;
    }

    const offset = reference.getTimeOffset();
    const axis = SV.getProject().getTimeAxis();
    const toSeconds = (time: Blick) => axis.getSecondsFromBlick(time + offset);
    const toBlick = (seconds: number) => axis.getBlickFromSeconds(seconds) - offset;
    const intervalSeconds = Math.max(1, Number(this.intervalMs.getValue()) || 0) / 1000;

    SV.getProject().newUndoRecord();
    plans.forEach((plan) => {
      group.removePitchControl(plan.curve.getIndexInParent());
      plan.remainders.forEach((segment) => {
        const curve = SV.create("PitchControlCurve");
        const position = segment[0][0];
        curve.setPosition(position);
        curve.setPitch(plan.anchorPitch);
        curve.setPoints(
          segment.map(([time, pitch]): [Blick, number] => [
            time - position,
            pitch - plan.anchorPitch,
          ]),
        );
        group.addPitchControl(curve);
      });
      plan.converted.forEach((range) => {
        sampleTimes(range, intervalSeconds, toSeconds, toBlick).forEach((time) => {
          const point = SV.create("PitchControlPoint");
          point.setPosition(time);
          point.setPitch(interpolatePitch(plan.samples, time));
          group.addPitchControl(point);
        });
      });
    });
  }

  private planCurves(group: NoteGroup, ranges: TimeRange[]): CurvePlan[] {
    const plans: CurvePlan[] = [];
    for (let i = 0; i < group.getNumPitchControls(); i++) {
      const control = group.getPitchControl(i);
      if (!isCurve(control)) {
        continue;
      }
      const samples = absoluteSamples(control);
      const split = splitCurve(samples, ranges);
      if (split.converted.length > 0) {
        plans.push({
          curve: control,
          anchorPitch: control.getPitch(),
          samples,
          converted: split.converted,
          remainders: split.remainders,
        });
      }
    }
    return plans;
  }
}
