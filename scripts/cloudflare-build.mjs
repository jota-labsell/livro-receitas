import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
execFileSync("npx", ["opennextjs-cloudflare", "build"], { stdio: "inherit" });
// OpenNext compiles .env files; keep only explicitly public build variables.
// All private values must come from runtime Worker secrets, never the bundle.
const file = path.resolve(".open-next/cloudflare/next-env.mjs");
const original = await import(pathToFileURL(file).href);
const content = ["development", "production", "test"]
  .map(
    (mode) =>
      `export const ${mode} = ${JSON.stringify(Object.fromEntries(Object.entries(original[mode] ?? {}).filter(([name]) => name.startsWith("NEXT_PUBLIC_"))))};`,
  )
  .join("\n");
await writeFile(file, content + "\n");
console.log(
  "Worker preparado: variáveis privadas removidas do módulo de ambiente gerado.",
);

execFileSync("node", ["scripts/check-worker-build.mjs"], { stdio: "inherit" });
