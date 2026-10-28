import { stat, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const compiledFile = path.resolve(".open-next/cloudflare/next-env.mjs");
try { await stat(compiledFile); }
catch { throw new Error("Build ausente ou incompleto. Execute npm run cloudflare:build e aguarde terminar sem erro antes de publicar."); }
const compiled = await import(pathToFileURL(compiledFile).href);
for (const mode of ["development", "production", "test"]) {
  if (
    Object.keys(compiled[mode] ?? {}).some(
      (name) => !name.startsWith("NEXT_PUBLIC_"),
    )
  )
    throw Error(
      "O build contém variáveis privadas. Execute npm run cloudflare:build antes de publicar.",
    );
}
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await walk(file);
    else {
      if (file.endsWith(".pdf"))
        throw Error("O PDF privado não deve estar nos assets públicos.");
      if ((await stat(file)).size > 25 * 1024 * 1024)
        throw Error(`Asset excede 25 MiB: ${file}`);
    }
  }
}
await walk(".open-next/assets");
async function rejectPdf(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await rejectPdf(file);
    else if (file.endsWith(".pdf"))
      throw Error("PDF completo não deve ser incluído no artefato do Worker.");
  }
}
await rejectPdf(".open-next/server-functions");
console.log(
  "Artefato validado: variáveis privadas fora do bundle e PDF fora dos assets públicos.",
);
