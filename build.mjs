import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { build } from "esbuild";
import { transform } from "@swc/core";

const entryPoints = (await readdir("src"))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `src/${f}`);

const bundle = await build({
  entryPoints,
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "esnext",
  charset: "utf8",
  alias: { "@": "./src" },
  outdir: "dist",
  write: false,
});

await Promise.all(
  bundle.outputFiles.map(async (file) => {
    const { code } = await transform(file.text, {
      isModule: false,
      minify: false,
      jsc: {
        parser: { syntax: "ecmascript" },
        target: "es5",
        loose: true,
      },
    });
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, code);
  }),
);
