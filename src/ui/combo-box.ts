export function comboBox(choices: string[], value: WidgetValue, width = 1): SVPanelWidget {
  return { type: "ComboBox", choices, value, width };
}
