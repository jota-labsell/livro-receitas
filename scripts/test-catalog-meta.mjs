import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({entryPoints:["tests/catalog-meta.test.ts"],outfile:"work/catalog-meta.test.mjs",bundle:true,platform:"node",format:"esm",packages:"external"});
execFileSync(process.execPath,["--test","work/catalog-meta.test.mjs"],{stdio:"inherit"});
