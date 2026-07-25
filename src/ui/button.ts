export function button(text: string, value: WidgetValue, width: number): SVPanelWidget {
  return { type: "Button", text, value, width };
}
