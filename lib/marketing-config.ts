import { operationSettings } from "./operations-settings";

/** Independent of payment readiness: only an explicit Pixel flag enables tracking. */
export async function marketingConfig(env: CloudflareEnv | null) {
  const settings = await operationSettings(env || {});
  return {
    pixelId: settings.pixelId,
    enabled: env?.META_PIXEL_ENABLED === "true" && /^\d{5,30}$/.test(settings.pixelId),
  };
}
