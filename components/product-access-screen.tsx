"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./product-access.module.css";

const messages: Record<string, { title: string; text: string }> = {
  approved: { title: "Seu e-book está liberado", text: "Pagamento aprovado e acesso autorizado. Baixe o PDF e salve uma cópia em Arquivos ou Downloads." },
  session: { title: "Precisamos recuperar seu acesso", text: "Não encontramos o vínculo da compra neste navegador. Isso não significa que seu pagamento não foi aprovado. Abra o link privado recebido do atendimento ou solicite a recuperação abaixo. Não é necessário pagar novamente." },
  pending: { title: "Aguardando confirmação", text: "Seu pagamento ainda não foi confirmado. Confira novamente em alguns instantes. Não faça outro pagamento para recuperar o acesso." },
  rejected: { title: "Pagamento não aprovado", text: "O provedor não confirmou a aprovação deste pedido. Se você possui comprovante de outra compra aprovada, fale com o atendimento para localizar o acesso correto." },
  cancelled: { title: "Pedido cancelado", text: "Este pedido consta como cancelado. Se você já pagou, fale com o atendimento para conferir a compra." },
  refunded: { title: "Pagamento reembolsado", text: "O acesso deste pedido está suspenso porque o pagamento consta como reembolsado. Entre em contato se precisar conferir essa situação." },
  charged_back: { title: "Pagamento em contestação", text: "O acesso está suspenso enquanto este pagamento consta como contestado. Fale com o atendimento." },
  expired: { title: "Seu link expirou", text: "Solicite ao atendimento um novo link privado. A renovação depende da conferência da compra, sem nova cobrança." },
  revoked: { title: "Link desativado", text: "Este link foi revogado. Fale com o atendimento para conferir seu acesso e solicitar um novo link." },
  invalid: { title: "Não conseguimos validar este link", text: "Abra o link completo fornecido pelo atendimento. Se o problema continuar, solicite a recuperação do acesso." },
  storage: { title: "Arquivo temporariamente indisponível", text: "Seu pagamento foi confirmado, mas não conseguimos obter o PDF agora. Tente novamente ou avise o atendimento." },
  verification: { title: "Não conseguimos conferir agora", text: "A consulta de pagamento ou o serviço de acesso está temporariamente indisponível. Tente novamente. Não faça outro pagamento." },
};
export function ProductAccessScreen() {
  const [state, setState] = useState("loading"), [busy, setBusy] = useState(false);
  const [hasToken, setHasToken] = useState(false), [paste, setPaste] = useState("");
  const token = useRef("");
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(location.hash.slice(1)).get("token");
    if (fragment) {
      token.current = fragment; setHasToken(true); setState("ready");
      // Remove bearer from history. No analytics on this page.
      history.replaceState(null, "", "/acesso");
    } else {
      const previous = new URLSearchParams(location.search).get("estado");
      if (previous && messages[previous]) setState(previous);
      else void check();
    }
  }, []);
  async function check() {
    setBusy(true);
    try {
      const response = await fetch("/api/product-access", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json() as { state: string }; setState(messages[data.state] ? data.state : "verification");
    } catch { setState("verification"); }
    finally { setBusy(false); }
  }
  async function redeem() {
    setBusy(true);
    try {
      let candidate = token.current;
      if (!candidate && paste) {
        try { candidate = new URLSearchParams(new URL(paste).hash.slice(1)).get("token") || ""; } catch { candidate = ""; }
      }
      if (!/^[a-f0-9]{64}$/.test(candidate)) { setState("invalid"); return; }
      const response = await fetch("/api/product-access", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: candidate }) });
      const result = await response.json() as { state: string };
      if (response.ok) { token.current = ""; setPaste(""); setHasToken(false); await check(); }
      else setState(messages[result.state] ? result.state : "verification");
    } catch { setState("verification"); }
    finally { setBusy(false); }
  }
  const content = messages[state];
  return <div className={styles.screen}>
    <header className={styles.brand}>RECEITAS PREMIUM <span>ÁREA DO COMPRADOR</span></header>
    <main className={styles.card} aria-busy={busy}>
      <p className={styles.eyebrow}>SEU LIVRO DIGITAL</p>
      <h1>{state === "loading" ? "Conferindo seu acesso…" : state === "ready" ? "Acesse suas 150 receitas" : content?.title}</h1>
      <p role="status">{state === "ready" ? "Você recebeu um link privado. Toque abaixo para validar o pagamento e abrir seu acesso neste navegador. O link não é utilizado pela prévia automática de mensagens." : content?.text}</p>
      <div className={styles.product}><img src="/ebook/page-0.webp" alt="Capa de 150 Doces para Comer e Vender" width="96" height="136" /><div><strong>150 Doces para Comer e Vender</strong><p>E-book em PDF · 167 páginas</p></div></div>
      {state === "approved" && <><a className={styles.primary} href="/api/download">Baixar meu e-book</a><p className={styles.hint}>No iPhone, use Compartilhar → Salvar em Arquivos. Em navegadores de aplicativos, abra esta página no Safari ou Chrome. Para trocar de navegador, use seu link privado.</p></>}
      {hasToken && state !== "approved" && <button className={styles.primary} disabled={busy} onClick={() => void redeem()}>{busy ? "Conferindo…" : "Validar meu acesso"}</button>}
      {!["ready", "loading"].includes(state) && <button className={styles.secondary} disabled={busy} onClick={() => void check()}>{busy ? "Consultando…" : "Conferir novamente"}</button>}
      {state !== "approved" && state !== "loading" && !hasToken && <form onSubmit={e => { e.preventDefault(); void redeem(); }} className={styles.form}>
        <label htmlFor="recovery-link">Já recebeu um link privado do atendimento?</label>
        <input id="recovery-link" type="password" autoComplete="off" value={paste} onChange={e => setPaste(e.target.value)} placeholder="Cole seu link de acesso aqui" maxLength={2048} />
        <button className={styles.secondary} disabled={busy || !paste}>Recuperar com meu link</button>
      </form>}
      <aside className={styles.support}><strong>Precisa recuperar ou renovar seu acesso?</strong><p>Fale com o atendimento pelo e-mail da compra e informe a referência do pedido ou comprovante. Não envie dados de cartão. O atendimento confere a compra antes de gerar o link.</p><a href="mailto:receitaspremium150@gmail.com?subject=Recuperar%20acesso%20ao%20e-book">receitaspremium150@gmail.com</a><p>Não há envio automático de e-mail nesta página.</p></aside>
    </main>
    <footer className={styles.footer}><a href="/privacidade">Privacidade</a><a href="/termos">Termos de compra</a></footer>
  </div>;
}
