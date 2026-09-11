import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE_FILES = ["src/common/parameter-control-targets.ts", "src/parameter-control.ts"];
const UNSUPPORTED_ARRAY_METHODS = [".find(", ".findIndex(", ".flatMap("];

test("Parameter Control avoids Array methods missing in SynthV runtime", () => {
  const violations = [];

  SOURCE_FILES.forEach((file) => {
    const source = readFileSync(file, "utf8");
    UNSUPPORTED_ARRAY_METHODS.forEach((method) => {
      if (source.includes(method)) {
        violations.push(`${file}: ${method}`);
      }
    });
  });

  assert.deepEqual(violations, []);
});
