import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const remote = process.argv.includes("--remote");
const manifest = JSON.parse(readFileSync("public/ebook/manifest.json", "utf8"));
const pdf = readFileSync("private/150-doces.pdf");
if (createHash("sha256").update(pdf).digest("hex") !== manifest.sha256)
  throw Error("O PDF não corresponde às prévias");
execFileSync(
  "npx",
  [
    "wrangler",
    "r2",
    "object",
    "put",
    `receitas-premium-150-ebooks/sha256/${manifest.sha256}.pdf`,
    "--file",
    "private/150-doces.pdf",
    "--content-type",
    "application/pdf",
    remote ? "--remote" : "--local",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, WRANGLER_LOG_PATH: "/tmp/wrangler-logs" },
  },
);
