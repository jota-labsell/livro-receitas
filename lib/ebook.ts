import "server-only";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { cloudflareEnv } from "./runtime";
export const ebookPath = path.join(process.cwd(), "private/150-doces.pdf");
import { EBOOK_PREVIEW, type EbookManifest } from "./ebook-preview";
export type { EbookManifest } from "./ebook-preview";
const manifest = EBOOK_PREVIEW;
export const ebookObjectKey = `sha256/${manifest.sha256}.pdf`;
export async function getEbook(): Promise<EbookManifest | null> {
  try {
    if (manifest.images.length < 7) return null;
    const env = cloudflareEnv();
    if (env) {
      if (!env.EBOOKS) return null;
      const object = await env.EBOOKS.head(ebookObjectKey);
      return object && object.size === manifest.bytes ? manifest : null;
    }
    const pdf = await readFile(ebookPath);
    if (createHash("sha256").update(pdf).digest("hex") !== manifest.sha256)
      return null;
    for (const file of [...manifest.images, manifest.video, manifest.gif])
      await readFile(path.join(process.cwd(), "public", file));
    return manifest;
  } catch {
    return null;
  }
}
export async function getEbookBody(): Promise<
  ReadableStream | Uint8Array | null
> {
  const env = cloudflareEnv();
  if (env) {
    const object = await env.EBOOKS?.get(ebookObjectKey);
    return object && object.size === manifest.bytes ? object.body : null;
  }
  return new Uint8Array(await readFile(ebookPath));
}
