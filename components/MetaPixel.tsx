"use client";
import { useEffect } from "react";
import { configureMetaPixel, metaPageView } from "@/lib/meta-pixel";
import { visitId } from "@/lib/analytics";

export function MetaPixel() {
  useEffect(() => {
    let disposed = false;
    void fetch("/api/marketing")
      .then((response) => {
        if (!response.ok) throw new Error("marketing unavailable");
        return response.json() as Promise<{ enabled?: boolean }>;
      })
      .then((config) => {
        if (disposed) return;
        const enabled = config.enabled === true;
        configureMetaPixel(enabled, enabled, false);
        if (enabled) metaPageView(visitId());
      })
      .catch(() => configureMetaPixel(false, false));
    return () => { disposed = true; };
  }, []);

  return null;
}
