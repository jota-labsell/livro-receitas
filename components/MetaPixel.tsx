"use client";
import { useEffect } from "react";
import { configureMetaPixel, metaPageView } from "@/lib/meta-pixel";
import { visitId } from "@/lib/analytics";
import { metaAttribution } from "@/lib/meta-attribution-client";

export function MetaPixel() {
  useEffect(() => {
    let disposed = false;
    const attribution = metaAttribution();
    void fetch("/api/marketing")
      .then((response) => {
        if (!response.ok) throw new Error("marketing unavailable");
        return response.json() as Promise<{ enabled?: boolean }>;
      })
      .then((config) => {
        if (disposed) return;
        const enabled = config.enabled === true;
        configureMetaPixel(enabled, enabled && attribution.allowed, !attribution.allowed);
        if (enabled) metaPageView(visitId());
      })
      .catch(() => configureMetaPixel(false, false));
    return () => { disposed = true; };
  }, []);

  return null;
}
