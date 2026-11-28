import { comboBox } from "@/ui/combo-box";
import { label } from "@/ui/label";
import { row } from "@/ui/row";
import type { NoteFeature } from "./feature";

export class NoteManagementPanel {
  private readonly featureValue = SV.create("WidgetValue");
  private activeIndex = 0;

  constructor(
    private readonly title: string,
    private readonly features: NoteFeature[],
  ) {
    this.featureValue.setValue(0);
    // Read the widget instead of the callback argument so hosts that omit it still work.
    this.featureValue.setValueChangeCallback(() =>
      this.selectFeature(Number(this.featureValue.getValue())),
    );
    this.features[this.activeIndex]?.activate?.();
  }

  getState(): SVSidePanelState {
    const feature = this.features[this.activeIndex];
    if (feature === undefined) {
      return { title: this.title, rows: [label("No features available yet.")] };
    }

    return {
      title: this.title,
      rows: [
        label("Feature"),
        row([
          comboBox(
            this.features.map((item) => item.label),
            this.featureValue,
          ),
        ]),
        ...feature.rows(),
      ],
    };
  }

  private selectFeature(index: number): void {
    const next = Math.floor(index);
    if (!(next >= 0 && next < this.features.length) || next === this.activeIndex) {
      return;
    }
    this.features[this.activeIndex]?.deactivate?.();
    this.activeIndex = next;
    this.features[next].activate?.();
    SV.refreshSidePanel();
  }
}
