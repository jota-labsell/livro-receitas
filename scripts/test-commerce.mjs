import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({
  entryPoints: ["tests/commerce.test.ts"],
  outfile: "work/commerce.test.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
execFileSync(process.execPath, ["--test", "work/commerce.test.mjs"], {
  stdio: "inherit",
});
