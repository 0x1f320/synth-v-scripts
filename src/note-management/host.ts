export function hasSelectedNotes(): boolean {
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

/** Refreshes the side panel whenever the note selection changes (best-effort). */
export function refreshOnSelectionChange(): void {
  try {
    const selection = SV.getMainEditor().getSelection();
    selection.registerSelectionCallback(() => SV.refreshSidePanel());
    selection.registerClearCallback(() => SV.refreshSidePanel());
  } catch (_error) {
    // Features still check the selection directly when they act.
  }
}

export function showMessage(title: string, message: string): void {
  if (typeof SV.showMessageBoxAsync === "function") {
    SV.showMessageBoxAsync(title, message, () => {});
  } else {
    SV.showMessageBox(title, message);
  }
}
