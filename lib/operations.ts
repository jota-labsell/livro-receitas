import { randomUUID } from "node:crypto";
import { CommerceError, hash, type CommerceEnv } from "./commerce";
export function reportFilter(params: URLSearchParams, now = Date.now()) {
  const date = (value: string | null, fallback: number) => {
    if (!value) return fallback;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value + "T00:00:00-03:00")) ||
      new Date(Date.parse(value + "T00:00:00-03:00") - 10800000)
        .toISOString()
        .slice(0, 10) !== value
    )
      throw new CommerceError(400, "Data inválida.");
    return Date.parse(value + "T00:00:00-03:00");
  };
  const today = new Date(now - 10800000).toISOString().slice(0, 10);
  const end = date(params.get("end") || today, now) + 86400000;
  const start = date(params.get("start"), end - 7 * 86400000);
  if (start >= end || end - start > 366 * 86400000)
    throw new CommerceError(400, "Escolha um período de até 366 dias.");
  const status = params.get("status") || "";
  if (
    status &&
    ![
      "created",
      "processing",
      "pending",
      "approved",
      "rejected",
      "cancelled",
      "refunded",
      "charged_back",
    ].includes(status)
  )
    throw new CommerceError(400, "Status inválido.");
  return {
    start,
    end,
    status,
    source: (params.get("source") || "").trim().slice(0, 160),
    q: (params.get("q") || "").trim().slice(0, 100),
    page: Math.max(
      1,
      Math.min(10000, Math.floor(Number(params.get("page")) || 1)),
    ),
  };
}
export async function recordVisit(
  env: CommerceEnv,
  visitId: string,
  input: unknown,
) {
  const data =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const clean = (v: unknown) =>
    typeof v === "string"
      ? v
          .replace(/[\u0000-\u001f]/g, "")
          .trim()
          .slice(0, 160)
      : "";
  const landing =
    typeof data.landing === "string" && /^\/(?!\/)/.test(data.landing)
      ? data.landing.split(/[?#]/)[0].slice(0, 250)
      : "/";
  const source = clean(data.source) || "direto";
  const now = Date.now();
  await env
    .ORDERS!.prepare(
      `INSERT INTO operation_sessions(visit_hash,source,medium,campaign,content,term,landing,first_seen,last_seen) VALUES(?,?,?,?,?,?,?,?,?)
 ON CONFLICT(visit_hash) DO UPDATE SET last_seen=excluded.last_seen`,
    )
    .bind(
      hash(visitId),
      source,
      clean(data.medium),
      clean(data.campaign),
      clean(data.content),
      clean(data.term),
      landing,
      now,
      now,
    )
    .run();
}
export async function saveOperationSettings(
  env: CommerceEnv,
  actor: string,
  input: Record<string, unknown>,
) {
  if (
    typeof input.pixelId !== "string" ||
    !/^\d{5,30}$/.test(input.pixelId) ||
    typeof input.capiPaused !== "boolean"
  )
    throw new CommerceError(
      400,
      "Informe um Pixel válido e a preferência de envio.",
    );
  const now = Date.now();
  await env.ORDERS!.batch([
    env
      .ORDERS!.prepare(
        `INSERT INTO operation_settings(id,pixel_id,capi_paused,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET pixel_id=excluded.pixel_id,capi_paused=excluded.capi_paused,updated_at=excluded.updated_at`,
      )
      .bind(input.pixelId, input.capiPaused ? 1 : 0, now),
    env
      .ORDERS!.prepare(
        "INSERT INTO operation_audit(id,actor,action,created_at) VALUES(?,?,?,?)",
      )
      .bind(randomUUID(), actor, "update_tracking_settings", now),
  ]);
}
