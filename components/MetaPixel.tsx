"use client";
import { useEffect, useState } from "react";
import { configureMetaPixel, metaPageView, setMetaConsent } from "@/lib/meta-pixel";
import { visitId } from "@/lib/analytics";
const KEY = "recipe-ad-measurement";
export function MetaPixel() {
  const [active, setActive] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let disposed = false;
    void fetch("/api/marketing").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(config => {
      if (disposed) return;
      let preference: string | null = null;
      try { preference = localStorage.getItem(KEY); } catch {}
      const enabled = typeof config === "object" && config !== null && "enabled" in config && config.enabled === true;
      setChoice(preference); setActive(enabled); setOpen(enabled && !preference);
      configureMetaPixel(enabled, preference === "allow", preference === "deny");
      metaPageView(visitId());
    }).catch(() => configureMetaPixel(false, false));
    return () => { disposed = true; };
  }, []);
  function select(value: "allow" | "deny") {
    try { localStorage.setItem(KEY, value); } catch {}
    setChoice(value); setOpen(false); setMetaConsent(value === "allow");
    if (value === "allow") metaPageView(visitId());
  }
  if (!active) return null;
  return <>
    {open && <aside className="ad-preference" aria-label="Preferência de medição dos anúncios">
      <p>Permitir cookies da Meta para medir nossos anúncios? Sua escolha não interfere na compra. <a href="/privacidade">Privacidade</a></p>
      <div><button type="button" onClick={() => select("allow")}>Permitir</button><button type="button" onClick={() => select("deny")}>Não permitir</button></div>
    </aside>}
    <div className="ad-preference-settings"><button type="button" onClick={() => setOpen(true)}>Preferências de medição{choice === "deny" ? " · desativada" : ""}</button></div>
  </>;
}
