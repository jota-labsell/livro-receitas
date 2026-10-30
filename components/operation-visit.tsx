"use client";
import { useEffect } from "react";
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
    const q = new URLSearchParams(location.search);
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitId: visitId(),
        attribution: {
          source:
            q.get("utm_source") ||
            (q.has("fbclid")
              ? "meta"
              : document.referrer
                ? "referencia"
                : "direto"),
          medium: q.get("utm_medium"),
          campaign: q.get("utm_campaign"),
          content: q.get("utm_content"),
          term: q.get("utm_term"),
          landing: location.pathname,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
