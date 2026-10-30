import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({ entryPoints: ["tests/product-access.test.ts"], outfile: "work/product-access.test.mjs", bundle: true, platform: "node", format: "esm", packages: "external",
  plugins: [{ name: "isolated-worker-bindings", setup(builder) {
    builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "next/server.js", external: true }));
    // Route handlers stay real; only environment bindings and private storage are injected.
    builder.onLoad({ filter: /lib[\\/]runtime\.ts$/ }, () => ({ contents: "export function cloudflareEnv(){return globalThis.__accessTestEnv}; export function siteUrl(){return globalThis.__accessTestEnv?.SITE_URL}", loader: "js" }));
    builder.onLoad({ filter: /lib[\\/]ebook\.ts$/ }, () => ({ contents: "export async function getEbook(){return globalThis.__accessTestStorage?.manifest()}; export async function getEbookBody(){return globalThis.__accessTestStorage?.body()}", loader: "js" }));
  } }],
});
execFileSync(process.execPath, ["--test", "work/product-access.test.mjs"], { stdio: "inherit" });
