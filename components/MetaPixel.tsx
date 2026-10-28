"use client";
import { useEffect, useRef, useState } from "react";
import { configureMetaPixel, metaPageView, setMetaConsent } from "@/lib/meta-pixel";
import { visitId } from "@/lib/analytics";
const KEY = "recipe-ad-measurement";
export function MetaPixel() {
  const [active, setActive] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selectionVersion = useRef(0);
  useEffect(() => {
    let disposed = false;
    void fetch("/api/marketing").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(config => {
      if (disposed) return;
      let preference: string | null = null;
      try { preference = localStorage.getItem(KEY); } catch {}
      const enabled = typeof config === "object" && config !== null && "enabled" in config && config.enabled === true;
      setChoice(preference); setActive(enabled); setOpen(false);
      configureMetaPixel(enabled, preference === "allow", preference === "deny");
      metaPageView(visitId());
    }).catch(() => configureMetaPixel(false, false));
    return () => { disposed = true; };
  }, []);
  function select(value: "allow" | "deny") {
    try { localStorage.setItem(KEY, value); } catch {}
    const version = ++selectionVersion.current;
    setChoice(value); setOpen(false);
    if (value === "deny") setMetaConsent(false);
    // Sync order-level consent before flushing any queued Purchase to the server.
    const sync = fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: value === "allow" }), keepalive: true,
      signal: AbortSignal.timeout(3000) }).catch(() => {});
    if (value === "allow") void sync.finally(() => {
      if (selectionVersion.current !== version) return;
      setMetaConsent(true); metaPageView(visitId());
    });
  }
  if (!active) return null;
  return <>
    <div className="ad-preference-settings"><button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="ad-measurement-settings">Preferências de privacidade{choice === "deny" ? " · medição desativada" : ""}</button></div>
    {open && <aside id="ad-measurement-settings" className="ad-preference" aria-label="Preferências de privacidade e medição de anúncios">
      <p>Você pode permitir ou recusar a medição de anúncios da Meta. Sua escolha não interfere na compra. <a href="/privacidade">Política de privacidade</a></p>
      <div><button type="button" onClick={() => select("allow")}>Permitir medição</button><button type="button" onClick={() => select("deny")}>Não permitir</button></div>
    </aside>}
  </>;
}
