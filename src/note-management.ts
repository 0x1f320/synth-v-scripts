import { getClientInfoFactory } from "@/common/client-info";
import type { NoteFeature } from "@/note-management/feature";
import { PitchLineToPoints } from "@/note-management/features/pitch-line-to-points";
import { refreshOnSelectionChange } from "@/note-management/host";
import { NoteManagementPanel } from "@/note-management/panel";

const SCRIPT_TITLE = "Note Management";

// Register features here; the dropdown lists them in this order.
const FEATURES: NoteFeature[] = [new PitchLineToPoints(SCRIPT_TITLE)];

const panel = new NoteManagementPanel(SCRIPT_TITLE, FEATURES);
refreshOnSelectionChange();

globalThis.getClientInfo = getClientInfoFactory(SCRIPT_TITLE, {
  minEditorVersion: 131330,
  type: "SidePanelSection",
});
globalThis.getSidePanelSectionState = () => panel.getState();
