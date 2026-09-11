import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("Lua build emits a runnable Parameter Control script bundle", () => {
  execFileSync("node_modules/.bin/tstl", ["-p", "tsconfig.lua.json"], {
    stdio: "pipe",
  });
  execFileSync("luac", ["-p", "dist/parameter-control.lua"], {
    stdio: "pipe",
  });

  const outputPath = "dist/parameter-control.lua";
  assert.equal(existsSync(outputPath), true);

  const lua = readFileSync(outputPath, "utf8");
  assert.match(lua, /getClientInfo/);
  assert.match(lua, /getSidePanelSectionState/);
  assert.match(lua, /Parameter Control/);
  assert.match(lua, /SV:create\("WidgetValue"\)/);
  assert.match(
    lua,
    /definePresetButton:setValue\(false\)[\s\S]{0,200}definePresetButton:setEnabled\(true\)[\s\S]{0,200}definePresetButton:setValueChangeCallback/,
  );
  assert.match(
    lua,
    /definePresetButton:setValueChangeCallback\([\s\S]{0,500}runButtonAction\([\s\S]{0,500}definePresetButton[\s\S]{0,500}deferPresetDialog/,
  );
  assert.match(
    lua,
    /extractPresetButton:setValue\(false\)[\s\S]{0,200}extractPresetButton:setEnabled\(false\)[\s\S]{0,200}extractPresetButton:setValueChangeCallback/,
  );
  assert.match(
    lua,
    /extractPresetButton:setValueChangeCallback\([\s\S]{0,500}runButtonAction\([\s\S]{0,500}extractPresetButton[\s\S]{0,500}deferExtractPresetDialog/,
  );
  assert.match(
    lua,
    /function ParameterControlPanel\.prototype\.resetButton\(self, button\)[\s\S]{0,500}resettingButton = true[\s\S]{0,500}button:setValue\(false\)[\s\S]{0,500}resettingButton = false/,
  );
  assert.match(
    lua,
    /function ParameterControlPanel\.prototype\.onStoredSettingChanged\(self\)[\s\S]{0,400}loadingStoredState[\s\S]{0,400}restoringDeltaValue[\s\S]{0,400}return/,
  );
  assert.match(
    lua,
    /function ParameterControlPanel\.prototype\.restoreDeltaForChoice\(self, choice\)[\s\S]{0,500}restoringDeltaValue = true[\s\S]{0,500}delta:setValue[\s\S]{0,500}restoringDeltaValue = false/,
  );
  assert.match(
    lua,
    /function ParameterControlPanel\.prototype\.deferPresetDialog\(self, value\)[\s\S]{0,700}SV:setTimeout\([\s\S]{0,700}runDeferredAction[\s\S]{0,700}editOrDefinePreset/,
  );
  assert.match(lua, /\.parameter-control-debug\.log/);
  assert.match(
    lua,
    /deletePresetButton:setValue\(false\)[\s\S]{0,200}deletePresetButton:setEnabled\(false\)[\s\S]{0,200}deletePresetButton:setValueChangeCallback/,
  );
  assert.match(
    lua,
    /deletePresetButton:setValueChangeCallback\([\s\S]{0,500}runButtonAction\([\s\S]{0,500}deletePresetButton[\s\S]{0,500}deferDeletePresetDialog/,
  );
  assert.match(lua, /function ParameterControlPanel\.prototype\.confirmDeleteSelectedPreset/);
  assert.match(lua, /Delete Preset: confirmation/);
  assert.match(
    lua,
    /applyButton:setValue\(false\)[\s\S]{0,200}applyButton:setEnabled\(true\)[\s\S]{0,200}applyButton:setValueChangeCallback/,
  );
  assert.match(
    lua,
    /local hasSelectedNotes = self:hasSelectedNotes\(\)[\s\S]{0,160}extractPresetButton:setEnabled\(hasSelectedNotes\)[\s\S]{0,160}applyButton:setEnabled\(hasSelectedNotes\)/,
  );
  assert.match(lua, /registerSelectionCallback\(/);
  assert.match(lua, /registerClearCallback\(/);
  assert.doesNotMatch(lua, /SV:showCustomDialog\(form\)/);
  assert.doesNotMatch(lua, /trying showCustomDialog"/);
  assert.match(lua, /trying showCustomDialogAsync/);
  assert.match(lua, /SV:showCustomDialogAsync\([\s\S]{0,240}function\(result\)/);
  assert.match(lua, /function ParameterControlPanel\.prototype\.openEmptyExtractDialog/);
  assert.match(lua, /Extract Preset: entries [\s\S]{0,240}openEmptyExtractDialog/);
  assert.match(lua, /No active parameters were detected in the selected note range\./);
  assert.match(lua, /dialogResultStatus/);
  assert.match(lua, /\.parameter-control\.json/);
  assert.match(lua, /io\.open/);
  assert.match(lua, /debug\.getinfo/);
  assert.doesNotMatch(lua, /YesNoCancel/);
  assert.doesNotMatch(lua, /next page/);
  assert.doesNotMatch(lua, /SV:setTimeout\(\s*0,/);
  assert.doesNotMatch(lua, /type\(SV\.showCustomDialog\)/);
  assert.doesNotMatch(lua, /type\(SV\.showCustomDialogAsync\)/);
});
