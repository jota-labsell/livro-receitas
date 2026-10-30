"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { metaConfirmedPurchase, type ConfirmedPurchase } from "@/lib/meta-pixel";
import { PRODUCT_CONFIG } from "@/lib/product.config";
import styles from "./purchase-experience.module.css";

type ConfirmedState = { status: string; purchase?: ConfirmedPurchase };
const PurchaseContext = createContext<(result: ConfirmedState) => void>(() => {});
export const usePurchaseState = () => useContext(PurchaseContext);

export function PurchaseExperience({ children }: { children: ReactNode }) {
  const [approved, setApproved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const accept = useCallback((result: ConfirmedState) => {
    setApproved(result.status === "approved");
    if (result.status === "approved" && result.purchase) metaConfirmedPurchase(result.purchase);
  }, []);

  // Recover using the HTTP-only order cookie and authoritative backend status.
  // No URL, localStorage, browser events, or caller-supplied order IDs authorize access.
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function recover() {
      await fetch("/api/orders/status", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    }).then(async response => {
      if (!response.ok) return;
      const result = await response.json() as ConfirmedState;
      if (!disposed) {
        accept(result);
        if (result.status === "pending" || result.status === "processing")
          timer = setTimeout(() => { void recover(); }, 10000);
      }
    }).catch(() => {
      if (!disposed) timer = setTimeout(() => { void recover(); }, 10000);
    });
    }
    void recover();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [accept]);

  useEffect(() => {
    if (!approved) return;
    const previousTitle = document.title;
    document.title = "Compra confirmada | 150 Doces";
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
    return () => { document.title = previousTitle; };
  }, [approved]);

  return <PurchaseContext.Provider value={accept}>
    {approved ? <div className={styles.screen}>
      <header className={styles.brand}>Receitas Premium · 150 Doces</header>
      <main className={styles.main}>
        <section className={styles.confirmation} aria-labelledby="purchase-heading">
          <CheckCircle2 className={styles.success} size={52} aria-hidden="true" />
          <p className={styles.badge}>COMPRA CONFIRMADA</p>
          <h1 id="purchase-heading" ref={heading} tabIndex={-1}>Pagamento aprovado!</h1>
          <p className={styles.intro}>Seu e-book está liberado. Baixe agora e tenha suas 150 receitas sempre à mão.</p>
          <div className={styles.product}>
            <img src="/ebook/page-0.webp" alt="Capa do e-book 150 Doces para Comer e Vender" width={778} height={1100} />
            <p>{PRODUCT_CONFIG.name}<span>Seu livro digital em PDF</span></p>
          </div>
          <a className={styles.download} href="/api/download"><Download size={21} aria-hidden="true" />BAIXAR MEU E-BOOK AGORA</a>
          <p className={styles.hint}>Salve o PDF em Arquivos ou Downloads no seu aparelho para consultar suas receitas sempre que quiser.</p>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>Precisa de ajuda? <a href="mailto:receitaspremium150@gmail.com">receitaspremium150@gmail.com</a></p>
        <nav aria-label="Links legais"><a href="/privacidade">Privacidade</a><a href="/termos">Termos de compra</a></nav>
      </footer>
    </div> : children}
  </PurchaseContext.Provider>;
}
