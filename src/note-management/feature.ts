/**
 * A feature selectable from the Note Management feature dropdown.
 *
 * Each feature owns its widgets: create them once (e.g. in the constructor) and return them
 * from `rows()` so their values survive switching away and back.
 */
export interface NoteFeature {
  /** Text shown in the feature dropdown. */
  readonly label: string;
  /** Controls rendered below the dropdown while this feature is selected. */
  rows(): SVPanelRow[];
  /** Called when this feature becomes the selected one. */
  activate?(): void;
  /** Called when another feature is selected instead of this one. */
  deactivate?(): void;
}
