"use client";
import { useEffect } from "react";
import {operationAttribution} from "@/lib/operation-attribution-client";
import { visitId } from "@/lib/analytics";
export function OperationVisit() {
  useEffect(() => {
    try {
      if (
        localStorage.getItem("recipe-ad-measurement") === "deny" ||
        (navigator as Navigator & { globalPrivacyControl?: boolean })
          .globalPrivacyControl
      )
        return;
    } catch {}
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitId: visitId(),
        attribution: operationAttribution(),
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
