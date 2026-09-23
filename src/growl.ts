import { getClientInfoFactory } from "@/common/client-info";
import { button } from "@/ui/button";
import { label } from "@/ui/label";
import { row } from "@/ui/row";

// Sidebar adaptation of PNCSS's SynthV Growl behavior:
// https://github.com/crlotwhite/SynthV-Growl
// Frequency is the number of subdivisions in each selected note's range, not Hz.
const SCRIPT_TITLE = "SynthV Growl (Sidebar)";

const SETTINGS = [
  { text: "Start Position (%)", initial: 0, min: 0, max: 100, step: 0.1 },
  { text: "End Position (%)", initial: 100, min: 0, max: 100, step: 0.1 },
  { text: "Growl Depth (cents)", initial: 90, min: 0, max: 600, step: 0.1 },
  { text: "Pitch frequency 1/N", initial: 500, min: 1, max: 10000, step: 1 },
];

class GrowlPanel {
  private readonly values = SETTINGS.map((setting) => {
    const value = SV.create("WidgetValue");
    value.setValue(setting.initial);
    value.setValueChangeCallback(() => SV.refreshSidePanel());
    return value;
  });
  private readonly applyButton = SV.create("WidgetValue");

  constructor() {
    this.applyButton.setValueChangeCallback(() => this.apply());
    const selection = SV.getMainEditor().getSelection();
    selection.registerSelectionCallback(() => SV.refreshSidePanel());
    selection.registerClearCallback(() => SV.refreshSidePanel());
  }

  getState(): SVSidePanelState {
    const hasNotes = SV.getMainEditor().getSelection().getSelectedNotes().length > 0;
    this.applyButton.setEnabled(hasNotes && this.validSettings());
    return {
      title: SV.T(SCRIPT_TITLE),
      rows: [
        label(SV.T("Replaces existing pitch.")),
        ...SETTINGS.map((setting, index) =>
          row([
            {
              type: "Slider",
              text: SV.T(setting.text),
              format: setting.step === 1 ? "%1.0f" : "%1.1f",
              minValue: setting.min,
              maxValue: setting.max,
              interval: setting.step,
              value: this.values[index],
              width: 1,
            },
          ]),
        ),
        ...(!hasNotes ? [label(SV.T("Select at least one note."))] : []),
        ...(!this.validSettings() ? [label(SV.T("Start must be before end."))] : []),
        row([button(SV.T("Apply Growl"), this.applyButton, 1)]),
      ],
    };
  }

  private validSettings(): boolean {
    return (
      this.values.every((value, index) => {
        const number = value.getValue();
        return (
          typeof number === "number" &&
          number >= SETTINGS[index].min &&
          number <= SETTINGS[index].max
        );
      }) && this.values[0].getValue() < this.values[1].getValue()
    );
  }

  private apply(): void {
    // Re-read selection on click: it may have changed since the last panel refresh.
    const notes = SV.getMainEditor()
      .getSelection()
      .getSelectedNotes()
      .filter((note) => note.getDuration() > 0);
    if (notes.length === 0) {
      SV.showMessageBox(SV.T(SCRIPT_TITLE), SV.T("Select at least one note."));
      return;
    }
    if (!this.validSettings()) {
      SV.showMessageBox(SV.T(SCRIPT_TITLE), SV.T("Start must be before end."));
      return;
    }

    const startPercent = this.values[0].getValue() as number;
    const endPercent = this.values[1].getValue() as number;
    const depth = this.values[2].getValue() as number;
    const subdivisions = Math.round(this.values[3].getValue() as number);
    SV.getProject().newUndoRecord();
    for (const note of notes) {
      const start = note.getOnset() + (note.getDuration() * startPercent) / 100;
      const end = note.getOnset() + (note.getDuration() * endPercent) / 100;
      const pitch = note.getParent().getParameter("pitchDelta");
      pitch.remove(start, end);
      // Preserve the original script's zero anchors, 100 blicks outside the range.
      pitch.add(start - 100, 0);
      pitch.add(end + 100, 0);
      // Integer iteration avoids cumulative rounding errors and always includes the end.
      for (let index = 0; index <= subdivisions; index++) {
        const time = start + ((end - start) * index) / subdivisions;
        pitch.add(time, index % 2 === 0 ? depth : -depth);
      }
    }
  }
}

const TRANSLATIONS: { [language: string]: string[] } = {
  "ko-kr": [
    "SynthV Growl (사이드바)",
    "기존 피치를 교체합니다.",
    "시작 지점 (%)",
    "끝 지점 (%)",
    "Growl 깊이 (센트)",
    "피치 간격 1/N",
    "적어도 하나의 노트를 선택해주세요.",
    "시작 지점은 끝 지점보다 앞이어야 합니다.",
    "Growl 적용",
  ],
  "ja-jp": [
    "SynthV Growl (サイドバー)",
    "既存のピッチを置き換えます。",
    "始点 (%)",
    "終点 (%)",
    "Growl 深さ (セント)",
    "ピッチ間隔 1/N",
    "少なくとも1つのノートを選択してください。",
    "始点は終点より前にしてください。",
    "Growlを適用",
  ],
  "zh-cn": [
    "SynthV Growl (侧边栏)",
    "替换现有音高。",
    "起点 (%)",
    "终点 (%)",
    "咆哮深度 (音分)",
    "音高间距 1/N",
    "请至少选择一个音符。",
    "起点必须在终点之前。",
    "应用咆哮",
  ],
  "zh-tw": [
    "SynthV Growl (側邊欄)",
    "取代現有音高。",
    "起點 (%)",
    "終點 (%)",
    "咆哮深度 (音分)",
    "音高間距 1/N",
    "請至少選取一個音符。",
    "起點必須在終點之前。",
    "套用咆哮",
  ],
};
const TRANSLATION_KEYS = [
  SCRIPT_TITLE,
  "Replaces existing pitch.",
  ...SETTINGS.map((setting) => setting.text),
  "Select at least one note.",
  "Start must be before end.",
  "Apply Growl",
];

globalThis.getTranslations = (language) => {
  const translations = TRANSLATIONS[language.toLowerCase()];
  return translations ? TRANSLATION_KEYS.map((key, index) => [key, translations[index]]) : [];
};
globalThis.getClientInfo = () => ({
  ...getClientInfoFactory(SCRIPT_TITLE, {
    minEditorVersion: 131330,
    type: "SidePanelSection",
  })(),
  author: "PNCSS / 0x1F320",
});
const panel = new GrowlPanel();
globalThis.getSidePanelSectionState = () => panel.getState();
