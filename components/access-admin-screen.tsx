"use client";
import { useEffect, useState } from "react";
import styles from "./access-admin.module.css";
type Order = { id: string; status: string; amount_cents: number; created_at: number; environment?: string };
type Grant = { id: string; created_at: number; expires_at: number; revoked_at: number | null };
type Audit = { action: string; actor: string; previous_status?: string; created_at: number };
type Attempt = { id: string; provider_order_id: string | null; status: string; created_at: number };
const date = (n: number) => new Date(n).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
async function api(url: string, method = "GET", input?: unknown) {
  const response = await fetch(url, { method, cache: "no-store", headers: input ? { "Content-Type": "application/json" } : undefined, body: input ? JSON.stringify(input) : undefined });
  const data = await response.json() as { error?: string; orders: Order[]; hasMore: boolean; order: Order; grants: Grant[]; audit: Audit[]; attempts: Attempt[]; link: string };
  if (response.status === 401 && !url.endsWith("/login")) location.assign("/admin/acesso/entrar");
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data;
}
export function AccessAdminLogin() {
  const [key, setKey] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <main className={styles.login}><p className={styles.brand}>JOTAFY · ATENDIMENTO</p><h1>Recuperação de acesso</h1><p>Área restrita. Use a credencial de atendimento configurada no servidor.</p>
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/admin/ebook/login", "POST", { key }); setKey(""); location.assign("/admin/acesso"); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
      <label htmlFor="support-key">Credencial administrativa</label><input id="support-key" type="password" autoComplete="current-password" required value={key} onChange={e => setKey(e.target.value)} maxLength={128}/>
      <button disabled={busy}>{busy ? "Validando…" : "Entrar"}</button>
    </form><p role="alert">{error}</p></main>;
}
export function AccessAdminScreen() {
  const [orders, setOrders] = useState<Order[]>([]), [page, setPage] = useState(1), [more, setMore] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null), [grants, setGrants] = useState<Grant[]>([]), [audit, setAudit] = useState<Audit[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [lookup, setLookup] = useState(""), [confirmed, setConfirmed] = useState(false), [link, setLink] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [loaded, setLoaded] = useState(false);
  async function load(n: number) {
    setBusy(true); setError("");
    try { const data = await api(`/api/admin/ebook?page=${n}`); setOrders(data.orders); setMore(data.hasMore); setPage(n); setLoaded(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { void load(1); }, []);
  async function select(id: string, keepLink = false) {
    setBusy(true); setError(""); if (!keepLink) { setLink(""); setCopied(false); } setConfirmed(false);
    try { const data = await api(`/api/admin/ebook?order=${encodeURIComponent(id)}`); setSelected(data.order); setGrants(data.grants); setAudit(data.audit); setAttempts(data.attempts); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function issue() {
    if (!selected) return;
    setBusy(true); setError(""); setLink(""); setCopied(false);
    try { const data = await api("/api/admin/ebook", "POST", { action: "issue", orderId: selected.id, confirmed }); setLink(data.link); await select(selected.id, true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className={styles.shell}><header><div><p className={styles.brand}>JOTAFY · ATENDIMENTO</p><h1>Acesso ao produto</h1><p>Pedidos reais, conferência no provedor e recuperação auditada.</p></div><button onClick={async () => { try { await api("/api/admin/ebook/login", "DELETE"); location.assign("/admin/acesso/entrar"); } catch(e) { setError((e as Error).message); } }}>Sair</button></header>
    <main><p className={styles.notice}>Não envie o link antes de conferir a identidade do comprador pelos canais de atendimento. Esta área não envia mensagens, não cria pedidos e não realiza cobranças.</p>
      <p><a href="/admin/meta">Abrir diagnóstico da API da Meta</a></p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section><h2>Localizar pedido</h2><form onSubmit={e => { e.preventDefault(); void select(lookup); }}><label htmlFor="order-search">Identificador interno ou referência da order do Mercado Pago</label><div className={styles.row}><input id="order-search" value={lookup} onChange={e => setLookup(e.target.value)} required maxLength={100}/><button disabled={busy}>Consultar</button></div></form></section>
      <section aria-busy={busy}><div className={styles.row}><h2>Pedidos de produção</h2><button disabled={busy} onClick={() => void load(page)}>Atualizar</button></div>
        {!loaded ? <p>{busy ? "Carregando pedidos…" : "Aguardando consulta."}</p> : !orders.length ? <p>Nenhum pedido no histórico consultado.</p> : <div className={styles.scroll}><table><thead><tr><th>Pedido</th><th>Data · Brasília</th><th>Status</th><th>Valor</th><th>Ação</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td className={styles.id}>{o.id}</td><td>{date(o.created_at)}</td><td>{o.status}</td><td>{(o.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td><button disabled={busy} onClick={() => void select(o.id)}>Abrir</button></td></tr>)}</tbody></table></div>}
        <div className={styles.row}><button disabled={busy || page === 1} onClick={() => void load(page - 1)}>Anterior</button><span>Página {page}</span><button disabled={busy || !more} onClick={() => void load(page + 1)}>Próxima</button></div>
      </section>
      {selected && <section><h2>Conferir e recuperar</h2><p className={styles.id}>{selected.id}</p><p>Estado registrado: <strong>{selected.status}</strong> · Ambiente: <strong>{selected.environment}</strong> · Valor: R$ {(selected.amount_cents / 100).toFixed(2)}</p>
        <h3>Tentativas de pagamento</h3>{!attempts.length ? <p>Nenhuma tentativa registrada.</p> : <div className={styles.scroll}><table><thead><tr><th>Tentativa interna</th><th>Order Mercado Pago</th><th>Status</th><th>Data</th></tr></thead><tbody>{attempts.map(a => <tr key={a.id}><td className={styles.id}>{a.id}</td><td className={styles.id}>{a.provider_order_id || "Sem referência confirmada"}</td><td>{a.status}</td><td>{date(a.created_at)}</td></tr>)}</tbody></table></div>}
        <p>A geração consulta o Mercado Pago novamente. Apenas um pedido aprovado e elegível recebe um link. Validade: 7 dias. Reembolso e contestação bloqueiam o download.</p>
        <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Conferi o pedido e a identidade de quem solicita o acesso.</label>
        <button disabled={busy || !confirmed || selected.status !== "approved"} onClick={() => void issue()}>{busy ? "Conferindo…" : "Gerar link privado"}</button>
        {link && <div className={styles.private}><label htmlFor="private-link">Link privado · exibido somente nesta resposta</label><input id="private-link" readOnly type="password" value={link}/><button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("Não foi possível copiar. Selecione o campo privado e copie manualmente."); } }}>{copied ? "Link copiado" : "Copiar para atendimento"}</button><p>Não inclua este link em logs, relatórios ou canais públicos.</p></div>}
        <h3>Links emitidos</h3>{!grants.length ? <p>Nenhum link emitido para este pedido.</p> : grants.map(g => <div className={styles.grant} key={g.id}><div><span className={styles.id}>{g.id}</span><p>Emitido {date(g.created_at)} · Válido até {date(g.expires_at)} · {g.revoked_at ? "Revogado" : g.expires_at <= Date.now() ? "Expirado" : "Ativo"}</p></div><button disabled={busy || !!g.revoked_at} onClick={async () => { setBusy(true); try { await api("/api/admin/ebook", "POST", { action: "revoke", grantId: g.id }); setLink(""); await select(selected.id); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>Revogar</button></div>)}
        <h3>Auditoria</h3>{!audit.length ? <p>Nenhuma ação registrada.</p> : <ul>{audit.map((a,i) => <li key={i}>{date(a.created_at)} · {a.action === "issue" ? "Link emitido" : "Link revogado"} · {a.actor}{a.previous_status ? ` · estado anterior: ${a.previous_status}` : ""}</li>)}</ul>}
      </section>}
    </main><footer>Horários em Brasília · Dados pessoais e de cartão não são exibidos.</footer></div>;
}
