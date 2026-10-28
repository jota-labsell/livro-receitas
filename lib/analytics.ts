"use client";
import { metaFunnel } from "./meta-pixel";
export function visitId() {
  try {
    let id = sessionStorage.getItem("recipe-visit");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("recipe-visit", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
export function track(name: "offer_view" | "cta_click" | "checkout_start") {
  metaFunnel(name, visitId());
  const payload = JSON.stringify({
    name,
    visitId: visitId(),
    eventId: crypto.randomUUID(),
  });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
