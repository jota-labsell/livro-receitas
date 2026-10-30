"use client";
import { useEffect } from "react";
import { configureMetaPixel, metaPageView } from "@/lib/meta-pixel";
import { visitId } from "@/lib/analytics";
import { metaAttribution } from "@/lib/meta-attribution-client";

type MetaPixelProps = { enabled: boolean; pixelId: string };

/** The first PageView no longer waits for a browser-side configuration fetch. */
export function MetaPixel({ enabled, pixelId }: MetaPixelProps) {
  useEffect(() => {
    const attribution = metaAttribution();
    configureMetaPixel(enabled, enabled && attribution.allowed, !attribution.allowed, pixelId);
    if (enabled && attribution.allowed) metaPageView(visitId());
  }, [enabled, pixelId]);

  return null;
}
