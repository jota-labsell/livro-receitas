import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
export function cloudflareEnv(): CloudflareEnv | null {
  try {
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}
export function siteUrl() {
  return cloudflareEnv()?.SITE_URL || process.env.SITE_URL;
}
