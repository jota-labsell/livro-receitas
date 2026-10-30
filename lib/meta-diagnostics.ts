import {operationSettings} from './operations-settings';
import { randomUUID } from "node:crypto";
import { CommerceError, hash, type CommerceEnv } from "./commerce";
import { metaCapiReady } from './meta-capi';

export const DIAGNOSTIC_PIXEL = "1150409944170993";
export const DIAGNOSTIC_GRAPH_VERSION = "v26.0";
export type MetaTestResult = {
  accepted: boolean; eventId: string; checkedAt: number; httpStatus: number | null;
  eventsReceived: number; traceId: string | null; errorCode: number | null;
  errorSubcode: number | null; message: string;
};

export async function metaDiagnosticStatus(runtime: CommerceEnv) {
  if (!runtime.ORDERS) throw new CommerceError(503, "Banco indisponível para diagnóstico.");
  const db = runtime.ORDERS;
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('meta_purchase_delivery','meta_order_consent','meta_purchase_context','meta_purchase_match','meta_delivery_results')").all<{ name: string }>();
  const names = new Set(tables.results.map(row => row.name));
  const queueAvailable = names.has("meta_purchase_delivery"), consentAvailable = names.has("meta_order_consent");
  const resultsAvailable = names.has('meta_delivery_results');
  const tablesAvailable = names.size === 5;
  const purchases = await db.prepare(`SELECT o.id,o.amount_cents,f.created_at AS approved_at,
    ${queueAvailable ? "d.state,d.attempts,d.sent_at" : "NULL AS state,NULL AS attempts,NULL AS sent_at"},
    ${consentAvailable ? "c.consent" : "NULL AS consent"}
    ,${resultsAvailable ? 'r.http_status,r.error_code,r.trace_id' : 'NULL AS http_status,NULL AS error_code,NULL AS trace_id'}
    FROM orders o JOIN funnel_events f ON f.event_key='purchase:'||o.id
    ${queueAvailable ? "LEFT JOIN meta_purchase_delivery d ON d.order_id=o.id" : ""}
    ${consentAvailable ? "LEFT JOIN meta_order_consent c ON c.order_id=o.id" : ""}
    ${resultsAvailable ? 'LEFT JOIN meta_delivery_results r ON r.order_id=o.id' : ''}
    WHERE o.environment='production' AND o.status='approved' ORDER BY f.created_at DESC LIMIT 20`).all();
  const settings=await operationSettings(runtime);
  return {
    pixelId: settings.pixelId, graphVersion: DIAGNOSTIC_GRAPH_VERSION,
    capiPaused: settings.capiPaused, settingsAvailable: settings.available,
    tokenConfigured: Boolean(runtime.META_CAPI_ACCESS_TOKEN?.trim()),
    automaticEnabled: runtime.META_CAPI_ENABLED === "true",
    tablesAvailable, automaticFlowConnected: metaCapiReady(runtime) && tablesAvailable && settings.available && !settings.capiPaused,
    purchases: purchases.results, checkedAt: Date.now(),
  };
}

/** Isolated test transport: never writes to orders, funnel events or the live queue. */
export async function sendMetaDiagnostic(runtime: CommerceEnv, code: unknown, fetcher: typeof fetch = fetch): Promise<MetaTestResult> {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{4,80}$/.test(code.trim()))
    throw new CommerceError(400, "Informe o código de Eventos de teste da Meta (4 a 80 caracteres).");
  const token = runtime.META_CAPI_ACCESS_TOKEN?.trim();
  if (!token) throw new CommerceError(503, "META_CAPI_ACCESS_TOKEN não está configurado no Worker.");
  if (!runtime.SITE_URL || new URL(runtime.SITE_URL).protocol !== "https:")
    throw new CommerceError(503, "Configure o endereço HTTPS do site no Worker.");
  const settings=await operationSettings(runtime);
  const eventId = `diagnostic:${randomUUID()}`, checkedAt = Date.now();
  const base: MetaTestResult = { accepted: false, eventId, checkedAt, httpStatus: null,
    eventsReceived: 0, traceId: null, errorCode: null, errorSubcode: null, message: "" };
  const signal = AbortSignal.timeout(15000);
  let response: Response;
  try {
    response = await fetcher(`https://graph.facebook.com/${DIAGNOSTIC_GRAPH_VERSION}/${settings.pixelId}/events`, {
      // Workers rejects redirect:error before sending. Manual preserves the
      // no-redirect behavior without forwarding credentials to another host.
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      signal,
      body: JSON.stringify({ test_event_code: code.trim(), data: [{
        event_name: "Purchase", event_id: eventId, event_time: Math.floor(checkedAt / 1000),
        action_source: "website", event_source_url: new URL("/", runtime.SITE_URL).href,
        user_data: { external_id: [hash(eventId)] },
        custom_data: { value: 10, currency: "BRL", content_ids: ["150-doces-comer-vender"], content_type: "product" },
      }] }),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const detail = error instanceof Error ? error.message : "";
    const timeout = signal.aborted || name === "TimeoutError" || name === "AbortError";
    const request = name === "TypeError" && /redirect|header|unsupported|invalid.*(?:request|url)/i.test(detail);
    console.warn(JSON.stringify({ event: "meta_diagnostic_transport_failed", kind: timeout ? "timeout" : request ? "request" : "network" }));
    return { ...base, message: timeout
      ? "A conexão do servidor com a Meta atingiu o limite de 15 segundos. Tente novamente em instantes."
      : request ? "A configuração da requisição foi recusada no servidor antes do envio. O problema precisa ser corrigido na integração."
      : "Não foi possível completar a conexão do servidor com a Meta. Tente novamente em instantes; se persistir, confira os registros do servidor." };
  }
  base.httpStatus = response.status;
  if (response.status >= 300 && response.status < 400)
    return { ...base, message: "A Meta respondeu com um redirecionamento inesperado. O envio foi interrompido sem encaminhar a credencial para outro endereço." };
  const raw: unknown = await response.json().catch(() => null);
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const error = data.error && typeof data.error === "object" ? data.error as Record<string, unknown> : {};
  // Do not echo raw provider messages, submitted values or credentials.
  base.errorCode = Number.isSafeInteger(error.code) ? error.code as number : null;
  base.errorSubcode = Number.isSafeInteger(error.error_subcode) ? error.error_subcode as number : null;
  const trace = data.fbtrace_id ?? error.fbtrace_id;
  base.traceId = typeof trace === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(trace) && !trace.includes(token) ? trace : null;
  base.eventsReceived = Number.isSafeInteger(data.events_received) && data.events_received === 1 ? 1 : 0;
  base.accepted = response.ok && !data.error && base.eventsReceived === 1;
  base.message = base.accepted
    ? "A Meta confirmou um evento de teste. Confira Purchase em Eventos de teste; isso não confirma atribuição à campanha."
    : base.errorCode === 190 ? "A Meta recusou a autenticação. Confira a validade do token no Worker."
    : [10, 200].includes(base.errorCode ?? 0) ? "A Meta recusou a permissão. Confira o acesso do token ao Pixel indicado."
    : base.errorCode === 100 ? "A Meta recusou os parâmetros. Confira o código de teste e o acesso do token ao Pixel."
    : "A Meta não confirmou o recebimento. Confira o status HTTP, o código de erro e o rastreamento abaixo.";
  return base;
}
