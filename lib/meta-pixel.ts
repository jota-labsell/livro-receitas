"use client";
export const META_PIXEL_ID = "1150409944170993";
export type ConfirmedPurchase = { eventId: string; value: number; currency: string };
type QueuedEvent = { name: string; custom?: boolean; id: string; data: Record<string, unknown> };
type PixelFunction = ((...args: unknown[]) => void) & { queue: unknown[][]; callMethod?: (...args: unknown[]) => void; push?: PixelFunction; loaded?: boolean; version?: string };
declare global { interface Window { fbq?: PixelFunction; _fbq?: PixelFunction } }
let enabled: boolean | null = null;
let consent = false;
let declined = false;
let initialized = false;
const pending = new Map<string, QueuedEvent>();
const delivered = new Set<string>();
function initialize() {
  if (initialized) return;
  if (!window.fbq) {
    const pixel = function (...args: unknown[]) {
      if (pixel.callMethod) pixel.callMethod(...args); else pixel.queue.push(args);
    } as PixelFunction;
    pixel.queue = []; pixel.loaded = true; pixel.version = "2.0"; pixel.push = pixel;
    window.fbq = pixel; window._fbq = pixel;
    const script = document.createElement("script");
    script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.recipeMetaPixel = "true";
    document.head.appendChild(script);
  }
  // No automatic form scraping or advanced matching of checkout fields.
  window.fbq!("set", "autoConfig", false, META_PIXEL_ID);
  window.fbq!("init", META_PIXEL_ID);
  initialized = true;
}
function flush() {
  if (!enabled || !consent) return;
  initialize();
  for (const [key, event] of pending) {
    const storageKey = `recipe-meta:${event.id}`;
    let alreadySent = delivered.has(key);
    try { if (event.name === "Purchase") alreadySent ||= localStorage.getItem(storageKey) === "sent"; } catch {}
    if (!alreadySent) {
      window.fbq!(event.custom ? "trackSingleCustom" : "trackSingle", META_PIXEL_ID, event.name, event.data, { eventID: event.id });
      delivered.add(key);
      if (event.name === "Purchase") { try { localStorage.setItem(storageKey, "sent"); } catch {} }
    }
    // The server emits the matching CAPI Purchase from the authoritative
    // Mercado Pago reconciliation, using this same event_id for deduplication.
    pending.delete(key);
  }
}
function queue(key: string, event: QueuedEvent) {
  if (enabled === false || declined || delivered.has(key)) return;
  if (pending.size >= 30) pending.delete(pending.keys().next().value!);
  pending.set(key, event); flush();
}
export function configureMetaPixel(active: boolean, allowed: boolean, denied = false) {
  enabled = active; consent = allowed; declined = denied;
  if (!active || denied) pending.clear();
  flush();
}
export function setMetaConsent(allowed: boolean) {
  consent = allowed; declined = !allowed;
  if (initialized) window.fbq?.("consent", allowed ? "grant" : "revoke");
  if (!allowed) pending.clear();
  flush();
}
export function metaPageView(visit: string) {
  queue("page", { name: "PageView", id: `page:${visit}`, data: {} });
}
export function metaFunnel(name: "offer_view" | "cta_click" | "checkout_start", visit: string) {
  const map = { offer_view: "ViewContent", cta_click: "OfferCTAClick", checkout_start: "InitiateCheckout" };
  const key = name === "cta_click" ? `${name}:${crypto.randomUUID()}` : name;
  queue(key, { name: map[name], custom: name === "cta_click", id: `${key}:${visit}`, data: { content_ids: ["150-doces-comer-vender"], content_type: "product", value: 10, currency: "BRL" } });
}
export function metaConfirmedPurchase(purchase: ConfirmedPurchase) {
  if (!/^[a-f0-9]{64}$/.test(purchase.eventId) || purchase.value !== 10 || purchase.currency !== "BRL") return;
  queue(`purchase:${purchase.eventId}`, { name: "Purchase", id: purchase.eventId, data: { value: 10, currency: "BRL", content_ids: ["150-doces-comer-vender"], content_type: "product" } });
}

