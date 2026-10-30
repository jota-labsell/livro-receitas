"use client";
import { useEffect, useState } from "react";
import type { MetaTestResult } from "@/lib/meta-diagnostics";
import styles from "./meta-diagnostics.module.css";

type Purchase = { id: string; amount_cents: number; approved_at: number; state: string | null; attempts: number | null; sent_at: number | null; consent?: number | null; http_status?: number | null; error_code?: number | null; trace_id?: string | null };
type Status = { pixelId: string; graphVersion: string; tokenConfigured: boolean; automaticEnabled: boolean; tablesAvailable: boolean; automaticFlowConnected: boolean; purchases: Purchase[]; checkedAt: number };
const date = (value: number) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
async function request<T>(method = "GET", input?: unknown): Promise<T> {
  const response = await fetch("/api/admin/meta", { method, cache: "no-store", signal: AbortSignal.timeout(25000), headers: input ? { "Content-Type": "application/json" } : undefined, body: input ? JSON.stringify(input) : undefined });
  if (response.status === 401) { location.assign("/admin/meta/entrar"); throw new Error("Sua sessão expirou. Entre novamente."); }
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(typeof message === "string" ? message : "Não foi possível consultar o diagnóstico.");
  }
  return data as T;
}
export function MetaDiagnosticsScreen() {
  const [status, setStatus] = useState<Status | null>(null), [code, setCode] = useState("");
  const [result, setResult] = useState<MetaTestResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { setStatus(await request<Status>()); } catch (error) { setError(error instanceof Error ? error.message : "Consulta indisponível."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  return <main className={styles.shell}>
    <header><div><p className={styles.eyebrow}>JOTAFY · DIAGNÓSTICO</p><h1>API da Meta</h1><p>Confira a configuração, teste o recebimento e consulte as compras.</p></div><a href="/admin/acesso">Voltar aos pedidos</a></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section aria-busy={busy}><div className={styles.row}><h2>Configuração do servidor</h2><button disabled={busy} onClick={() => void load()}>{busy ? "Consultando…" : "Atualizar diagnóstico"}</button></div>
      {!status ? <p>{busy ? "Carregando configuração…" : "Não foi possível carregar. Tente atualizar."}</p> : <>
        <dl className={styles.cards}><div><dt>Pixel</dt><dd>{status.pixelId}</dd></div><div><dt>Token da API</dt><dd>{status.tokenConfigured ? "Configurado" : "Ausente"}</dd></div><div><dt>Envio automático</dt><dd>{status.automaticFlowConnected ? "Conectado" : "Integração pendente"}</dd></div><div><dt>Tabelas da Meta</dt><dd>{status.tablesAvailable ? "Presentes" : "Migration incompleta ou ausente"}</dd></div></dl>
        <p>API {status.graphVersion} · Chave de ativação automática: {status.automaticEnabled ? "ligada" : "desligada"} · Consulta: {date(status.checkedAt)}</p>
        <p className={styles.notice}>{status.automaticFlowConnected ? "Novas compras aprovadas são enviadas após a confirmação do Mercado Pago. Uma rotina verifica pendências a cada cinco minutos; o histórico abaixo mostra a confirmação da Meta." : "O envio automático depende da ativação, do token e das migrations. O teste abaixo verifica a conexão independentemente dessa ativação."}</p>
      </>}
    </section>
    <section><h2>Enviar Purchase de teste</h2><ol><li>Abra o Gerenciador de Eventos da Meta e selecione o Pixel indicado acima.</li><li>Em <strong>Eventos de teste</strong>, copie o código de teste do servidor.</li><li>Cole o código abaixo e envie. Depois confira o evento Purchase na Meta.</li></ol>
      <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); setResult(null);
        try { setResult(await request<MetaTestResult>("POST", { action: "test", testEventCode: code.trim() })); }
        catch (error) { setError(error instanceof Error ? error.message : "Teste indisponível."); } finally { setBusy(false); }
      }}><label htmlFor="meta-test-code">Código de eventos de teste</label><div className={styles.row}><input id="meta-test-code" required minLength={4} maxLength={80} pattern="[A-Za-z0-9_-]+" autoComplete="off" spellCheck={false} value={code} onChange={event => setCode(event.target.value)} placeholder="Ex.: TEST12345"/><button disabled={busy || !status?.tokenConfigured}>{busy ? "Aguarde…" : "Enviar evento de teste"}</button></div></form>
      <p>Envia um Purchase de teste de R$ 10,00, sem dados de comprador, pedido ou cobrança. O código de teste é obrigatório. O resultado fica nesta tela até recarregar ou iniciar outro teste.</p>
      {result && <div className={result.accepted ? styles.success : styles.error} role="status"><h3>{result.accepted ? "Meta confirmou o recebimento" : "Recebimento não confirmado"}</h3><p>{result.message}</p><dl className={styles.details}><dt>Horário · Brasília</dt><dd>{date(result.checkedAt)}</dd><dt>HTTP</dt><dd>{result.httpStatus ?? "Sem resposta"}</dd><dt>Eventos recebidos</dt><dd>{result.eventsReceived}</dd><dt>Evento</dt><dd>{result.eventId}</dd><dt>Rastreamento Meta</dt><dd>{result.traceId || "Não informado"}</dd><dt>Erro / subcódigo</dt><dd>{result.errorCode ?? "—"} / {result.errorSubcode ?? "—"}</dd></dl></div>}
    </section>
    <section><h2>Últimas compras aprovadas</h2><p>Horários em Brasília. O status descreve somente o envio pelo servidor; eventos do Pixel no navegador não aparecem neste histórico.</p>
      {status && !status.purchases.length ? <p>Nenhuma compra aprovada encontrada.</p> : <div className={styles.scroll}><table><thead><tr><th>Pedido</th><th>Aprovação</th><th>Valor</th><th>Envio pelo servidor</th><th>Tentativas</th><th>Resposta da Meta</th></tr></thead><tbody>{status?.purchases.map(purchase => <tr key={purchase.id}><td>{purchase.id}</td><td>{date(purchase.approved_at)}</td><td>{(purchase.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>{purchase.state === "sent" ? `Confirmado ${purchase.sent_at ? date(purchase.sent_at) : ""}` : (purchase.attempts ?? 0) >= 12 ? "Envio interrompido — confira a resposta" : purchase.state === "sending" ? "Em envio" : purchase.state === "pending" ? "Pendente / aguardando nova tentativa" : purchase.consent === 0 ? "Medição desativada" : "Sem registro de envio"}</td><td>{purchase.attempts ?? 0}</td><td>{purchase.http_status ? `HTTP ${purchase.http_status}` : "—"}{purchase.error_code ? ` · erro ${purchase.error_code}` : ""}{purchase.trace_id ? ` · ${purchase.trace_id}` : ""}</td></tr>)}</tbody></table></div>}
    </section>
    <footer>Recebimento pela Meta e atribuição à campanha são verificações diferentes. Este painel não consulta sua conta de anúncios e não confirma atribuição.</footer>
  </main>;
}
