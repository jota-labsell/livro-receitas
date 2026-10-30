"use client";
import {platformContext} from "@/lib/platform-attribution-client";
import {pageViewEventId} from "@/lib/meta-pixel";
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
        eventId: crypto.randomUUID(),pageViewEventId:pageViewEventId(visitId()),platform:platformContext(visitId()),
        attribution: operationAttribution(),
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
