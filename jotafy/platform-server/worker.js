var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// push.js
var encoder = new TextEncoder();
var base64 = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))), "base64");
var unbase64 = /* @__PURE__ */ __name((value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0)), "unbase64");
var b64url = /* @__PURE__ */ __name((bytes) => base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""), "b64url");
async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))].map((v) => v.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
var defaults = { approved: true, pix_generated: true, rejected: false, refunded: true, charged_back: true, cancelled: false, sound: true, vibration: true, showValue: true };
function preferences(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("preferences");
  const result = { ...defaults };
  for (const key of Object.keys(result)) if (key in input) {
    if (typeof input[key] !== "boolean") throw new Error("preferences");
    result[key] = input[key];
  }
  return result;
}
__name(preferences, "preferences");
function configured(env) {
  try {
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    return /^[a-f0-9]{64}$/i.test(env.FCM_TOKEN_ENCRYPTION_KEY || "") && /^[a-z][a-z0-9-]{4,62}$/.test(env.FCM_PROJECT_ID || "") && sa.project_id === env.FCM_PROJECT_ID && typeof sa.client_email === "string" && sa.client_email.endsWith(".iam.gserviceaccount.com") && typeof sa.private_key === "string" && sa.private_key.includes("BEGIN PRIVATE KEY");
  } catch {
    return false;
  }
}
__name(configured, "configured");
async function encryptionKey(env) {
  const bytes = Uint8Array.from(env.FCM_TOKEN_ENCRYPTION_KEY.match(/../g), (v) => parseInt(v, 16));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(encryptionKey, "encryptionKey");
async function encryptToken(env, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), encoder.encode(token));
  return base64(iv) + "." + base64(cipher);
}
__name(encryptToken, "encryptToken");
async function decryptToken(env, value) {
  const [iv, cipher] = value.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(iv) }, await encryptionKey(env), unbase64(cipher)));
}
__name(decryptToken, "decryptToken");
var accessCache;
function resetAccessCache() {
  accessCache = void 0;
}
__name(resetAccessCache, "resetAccessCache");
async function accessToken(env, fetcher, now) {
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  if (sa.project_id !== env.FCM_PROJECT_ID || !sa.client_email || !sa.private_key) throw new Error("firebase_configuration");
  if (accessCache && accessCache.email === sa.client_email && accessCache.expires > now + 6e4) return accessCache.token;
  const header = b64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const seconds = Math.floor(now / 1e3);
  const claims = b64url(encoder.encode(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: seconds, exp: seconds + 3600 })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", unbase64(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(header + "." + claims));
  const response = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: header + "." + claims + "." + b64url(signature) }) });
  if (!response.ok) throw new Error("firebase_auth");
  const data = await response.json();
  if (typeof data.access_token !== "string") throw new Error("firebase_auth");
  accessCache = { email: sa.client_email, token: data.access_token, expires: now + Math.min(Number(data.expires_in) || 3600, 3600) * 1e3 };
  return data.access_token;
}
__name(accessToken, "accessToken");
async function enqueue(env, now = Date.now()) {
  const authHash = await hash(env.JOTAFY_TOKEN);
  const devices = await env.DB.prepare("SELECT * FROM jotafy_devices WHERE active=1 AND auth_hash=? AND updated_at>? ORDER BY updated_at DESC LIMIT 100").bind(authHash, now - 90 * 864e5).all();
  for (const device of devices.results) {
    const rows = await env.DB.prepare("SELECT e.* FROM jotafy_events e JOIN platform_all_orders o ON o.id=e.order_id WHERE o.environment='production' AND e.seq>? ORDER BY e.seq LIMIT 200").bind(device.enqueued_through).all();
    if (!rows.results.length) continue;
    const prefs = preferences(JSON.parse(device.preferences));
    const stmts = rows.results.map((event) => env.DB.prepare("INSERT OR IGNORE INTO jotafy_outbox(device_id,event_seq,status,available_at,created_at) VALUES(?,?,?,?,?)").bind(device.id, event.seq, prefs[event.kind] === true && event.created_at >= device.registered_at && event.created_at > now - 36e5 ? "pending" : "skipped", now, now));
    stmts.push(env.DB.prepare("UPDATE jotafy_devices SET enqueued_through=MAX(enqueued_through,?) WHERE id=?").bind(rows.results.at(-1).seq, device.id));
    await env.DB.batch(stmts);
  }
}
__name(enqueue, "enqueue");
async function dispatch(env, { fetcher = fetch, now = Date.now() } = {}) {
  if (!configured(env)) {
    console.info(JSON.stringify({ event: "jotafy_push", stage: "not_attempted", reason: "firebase_configuration" }));
    return { configured: false, sent: 0 };
  }
  const started = Date.now(), originalFetcher = fetcher;
  fetcher = /* @__PURE__ */ __name((url, options = {}) => originalFetcher(url, { ...options, signal: AbortSignal.timeout(1e4) }), "fetcher");
  await enqueue(env, now);
  const authHash = await hash(env.JOTAFY_TOKEN);
  await env.DB.prepare("UPDATE jotafy_outbox SET status='expired',claim=NULL WHERE status IN ('pending','sending') AND (attempts>=8 OR created_at<?)").bind(now - 36e5).run();
  const pending = await env.DB.prepare("SELECT q.id FROM jotafy_outbox q WHERE q.status IN ('pending','sending') AND q.available_at<=? AND q.lease_until<=? ORDER BY q.id LIMIT 40").bind(now, now).all();
  let sent = 0;
  for (const candidate of pending.results) {
    if (Date.now() - started > 45e3) break;
    const claim = crypto.randomUUID();
    const leased = await env.DB.prepare("UPDATE jotafy_outbox SET status='sending',claim=?,lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND available_at<=? AND lease_until<=? RETURNING *").bind(claim, Math.max(now, Date.now()) + 12e4, candidate.id, now, now).first();
    if (!leased) continue;
    const item = await env.DB.prepare("SELECT e.*,d.token_cipher,d.preferences,d.auth_hash,d.active,d.application_id FROM jotafy_events e JOIN jotafy_devices d ON d.id=? JOIN platform_all_orders o ON o.id=e.order_id WHERE e.seq=? AND o.environment='production'").bind(leased.device_id, leased.event_seq).first();
    let status = "pending", error = "network", retry = now + Math.min(36e5, 15e3 * 2 ** Math.min(leased.attempts, 7));
    if (!item || !item.active || item.auth_hash !== authHash || !preferences(JSON.parse(item.preferences))[item.kind] || item.created_at < now - 36e5) {
      status = "skipped";
      error = null;
    } else {
      try {
        const token = await decryptToken(env, item.token_cipher);
        const bearer = await accessToken(env, fetcher, now);
        const response = await fetcher("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(env.FCM_PROJECT_ID) + "/messages:send", { method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token, data: { eventId: String(item.seq), kind: item.kind, method: item.method, amountCents: String(item.amount_cents), createdAt: String(item.created_at) }, android: { priority: "high", ttl: "3600s", restricted_package_name: item.application_id } } }) });
        if (response.ok) {
          status = "sent";
          error = null;
          sent++;
          console.info(JSON.stringify({ event: "jotafy_push", stage: "fcm_accepted" }));
        } else {
          let body = {};
          try {
            body = await response.json();
          } catch {
          }
          const unregistered = body.error?.details?.some((e) => e.errorCode === "UNREGISTERED");
          error = unregistered ? "unregistered" : "fcm_" + response.status;
          console.warn(JSON.stringify({ event: "jotafy_push", stage: "fcm_rejected", httpStatus: response.status, invalidToken: !!unregistered }));
          if (unregistered) {
            await env.DB.prepare("UPDATE jotafy_devices SET active=0 WHERE id=?").bind(leased.device_id).run();
            status = "dead";
          } else if ([400, 403, 404].includes(response.status)) status = "dead";
          else if (response.status === 401) resetAccessCache();
          const header = response.headers.get("Retry-After"), after = header === null ? 0 : Number(header);
          const delay = Number.isFinite(after) ? after * 1e3 : Date.parse(header) - now;
          if (delay > 0) retry = Math.max(retry, now + Math.min(delay, 36e5));
        }
      } catch {
        error = "send_unavailable";
        console.warn(JSON.stringify({ event: "jotafy_push", stage: "send_unavailable" }));
      }
    }
    await env.DB.prepare("UPDATE jotafy_outbox SET status=?,last_error=?,available_at=?,lease_until=0,claim=NULL WHERE id=? AND claim=?").bind(status, error, retry, leased.id, claim).run();
  }
  console.info(JSON.stringify({ event: "jotafy_push", stage: "dispatch_completed", candidates: pending.results.length, accepted: sent }));
  return { configured: true, sent };
}
__name(dispatch, "dispatch");

// technical.js
var uuid = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value), "uuid");
var reply = /* @__PURE__ */ __name((data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }), "reply");
async function technicalRoute(req, env) {
  const path = new URL(req.url).pathname, auth = await hash(env.JOTAFY_TOKEN);
  if (path === "/push/diagnostics" && req.method === "GET") {
    const [events, devices, outbox, tests, missing] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS count,MAX(created_at) AS last_created_at FROM jotafy_events"),
      env.DB.prepare("SELECT COUNT(*) AS authorized FROM jotafy_devices WHERE active=1 AND auth_hash=? AND updated_at>?").bind(auth, Date.now() - 90 * 864e5),
      env.DB.prepare("SELECT status,last_error,COUNT(*) AS count FROM jotafy_outbox GROUP BY status,last_error"),
      env.DB.prepare("SELECT status,COUNT(*) AS count FROM jotafy_push_tests GROUP BY status"),
      env.DB.prepare("SELECT COUNT(*) AS reconciled_without_event_last_hour FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE o.environment='production' AND a.updated_at>=? AND a.status IN ('approved','rejected','refunded','charged_back','cancelled') AND NOT EXISTS(SELECT 1 FROM jotafy_events e WHERE e.event_key=a.id||':'||a.status)").bind(Date.now() - 36e5)
    ]);
    return reply({ configured: configured(env), events: events.results[0], missingEvents: missing.results[0], devices: devices.results[0], outbox: outbox.results, technicalTests: tests.results, meaning: { sent: "FCM accepted only", posted: "client reports NotificationManager.notify; physical visibility unverified" } });
  }
  if (path === "/push/tests" && req.method === "POST") {
    if (!configured(env)) return reply({ code: "firebase_not_configured" }, 503);
    const raw = await req.text();
    if (raw.length > 1024) return reply({ error: "Dados inv\xE1lidos" }, 413);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply({ error: "Dados inv\xE1lidos" }, 400);
    }
    if (!uuid(data.id) || !uuid(data.deviceId)) return reply({ error: "Identificador inv\xE1lido" }, 400);
    const device = await env.DB.prepare("SELECT id FROM jotafy_devices WHERE id=? AND auth_hash=? AND active=1 AND updated_at>?").bind(data.deviceId, auth, Date.now() - 90 * 864e5).first();
    if (!device) return reply({ error: "Dispositivo n\xE3o registrado" }, 404);
    const existing = await env.DB.prepare("SELECT id FROM jotafy_push_tests WHERE id=? AND device_id=?").bind(data.id, data.deviceId).first();
    if (existing) return reply({ id: data.id, queued: true, test: true });
    const now = Date.now();
    const result = await env.DB.prepare("INSERT OR IGNORE INTO jotafy_push_tests(id,device_id,created_at,available_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM jotafy_push_tests WHERE device_id=? AND created_at>?)").bind(data.id, data.deviceId, now, now, data.deviceId, now - 6e4).run();
    if (!result.meta.changes) return reply({ error: "Aguarde um minuto antes de outro teste" }, 429);
    console.info(JSON.stringify({ event: "jotafy_push", stage: "technical_test_queued" }));
    return reply({ id: data.id, queued: true, test: true });
  }
  const match = path.match(/^\/push\/tests\/([a-f0-9-]{36})(\/receipt)?$/i);
  if (!match) return null;
  const row = await env.DB.prepare("SELECT t.* FROM jotafy_push_tests t JOIN jotafy_devices d ON d.id=t.device_id WHERE t.id=? AND d.auth_hash=? AND d.active=1").bind(match[1], auth).first();
  if (!row) return reply({ error: "Teste n\xE3o encontrado" }, 404);
  if (!match[2] && req.method === "GET") return reply({ test: true, id: row.id, status: row.status, attempts: row.attempts, lastError: row.last_error, receivedAt: row.received_at, postedAt: row.posted_at, blockedAt: row.blocked_at, physicalDisplay: "unverified" });
  if (match[2] && req.method === "POST") {
    const raw = await req.text();
    if (raw.length > 512) return reply({ error: "Dados inv\xE1lidos" }, 413);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply({ error: "Dados inv\xE1lidos" }, 400);
    }
    if (data.deviceId !== row.device_id || !["received", "posted", "blocked"].includes(data.stage)) return reply({ error: "Recibo inv\xE1lido" }, 400);
    const column = { received: "received_at", posted: "posted_at", blocked: "blocked_at" }[data.stage];
    await env.DB.prepare(`UPDATE jotafy_push_tests SET received_at=COALESCE(received_at,?),${column}=COALESCE(${column},?) WHERE id=?`).bind(Date.now(), Date.now(), row.id).run();
    console.info(JSON.stringify({ event: "jotafy_push", stage: "client_reported_" + data.stage }));
    return reply({ recorded: true });
  }
  return reply({ error: "M\xE9todo n\xE3o permitido" }, 405);
}
__name(technicalRoute, "technicalRoute");
async function dispatchTechnical(env, { fetcher = fetch, now = Date.now() } = {}) {
  if (!configured(env)) return;
  const auth = await hash(env.JOTAFY_TOKEN);
  await env.DB.prepare("UPDATE jotafy_push_tests SET status='expired',claim=NULL WHERE status IN ('pending','sending') AND (attempts>=8 OR created_at<?)").bind(now - 36e5).run();
  const rows = await env.DB.prepare("SELECT id FROM jotafy_push_tests WHERE status IN ('pending','sending') AND available_at<=? AND lease_until<=? LIMIT 5").bind(now, now).all();
  for (const candidate of rows.results) {
    const claim = crypto.randomUUID();
    const row = await env.DB.prepare("UPDATE jotafy_push_tests SET status='sending',claim=?,lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND available_at<=? AND lease_until<=? RETURNING *").bind(claim, Math.max(now, Date.now()) + 12e4, candidate.id, now, now).first();
    if (!row) continue;
    const device = await env.DB.prepare("SELECT token_cipher,application_id FROM jotafy_devices WHERE id=? AND active=1 AND auth_hash=? AND updated_at>?").bind(row.device_id, auth, now - 90 * 864e5).first();
    let status = "pending", error = null, retry = now + Math.min(36e5, 15e3 * 2 ** row.attempts);
    if (!device) status = "skipped";
    else try {
      const bounded = /* @__PURE__ */ __name((url, options = {}) => fetcher(url, { ...options, signal: AbortSignal.timeout(1e4) }), "bounded");
      const bearer = await accessToken(env, bounded, now), token = await decryptToken(env, device.token_cipher);
      const response = await bounded("https://fcm.googleapis.com/v1/projects/" + encodeURIComponent(env.FCM_PROJECT_ID) + "/messages:send", { method: "POST", headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token, data: { messageKind: "technical_test", testId: row.id, createdAt: String(row.created_at) }, android: { priority: "high", ttl: "3600s", restricted_package_name: device.application_id } } }) });
      if (response.ok) status = "sent";
      else {
        let body = {};
        try {
          body = await response.json();
        } catch {
        }
        const invalid = body.error?.details?.some((d) => d.errorCode === "UNREGISTERED");
        error = invalid ? "unregistered" : "fcm_" + response.status;
        if (invalid) {
          await env.DB.prepare("UPDATE jotafy_devices SET active=0 WHERE id=?").bind(row.device_id).run();
          status = "dead";
        } else if ([400, 403, 404].includes(response.status)) status = "dead";
        if (response.status === 401) resetAccessCache();
        const header = response.headers.get("Retry-After");
        const delay = header === null ? 0 : Number.isFinite(Number(header)) ? Number(header) * 1e3 : Date.parse(header) - now;
        if (delay > 0) retry = Math.max(retry, now + Math.min(delay, 36e5));
      }
      console.info(JSON.stringify({ event: "jotafy_push", stage: response.ok ? "technical_fcm_accepted" : "technical_fcm_rejected", httpStatus: response.status }));
    } catch {
      error = "send_unavailable";
      console.warn(JSON.stringify({ event: "jotafy_push", stage: "technical_send_unavailable" }));
    }
    await env.DB.prepare("UPDATE jotafy_push_tests SET status=?,last_error=?,available_at=?,lease_until=0,claim=NULL WHERE id=? AND claim=?").bind(status, error, retry, row.id, claim).run();
  }
}
__name(dispatchTechnical, "dispatchTechnical");

// worker.js
var reply2 = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }), "reply");
async function authenticated(req, env) {
  if (!env.JOTAFY_TOKEN || !/^[a-f0-9]{64}$/i.test(env.JOTAFY_TOKEN)) return false;
  const a = await hash(req.headers.get("Authorization") || ""), b = await hash("Bearer " + env.JOTAFY_TOKEN);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(authenticated, "authenticated");
var worker_default = {
  async fetch(req, env) {
    const download = new URL(req.url);
    if (req.method === "GET" && ["/downloads/JotaFy-2.0-preview.apk", "/downloads/JotaFy-2.0.1-preview-no-firebase.apk", "/downloads/JotaFy-2.0.2-preview-firebase.apk"].includes(download.pathname)) {
      if (!env.RELEASES) return reply2({ error: "Download indispon\xEDvel" }, 503);
      const filename = download.pathname.split("/").at(-1);
      download.pathname = "/" + filename;
      const asset = await env.RELEASES.fetch(new Request(download.toString()));
      if (asset.status !== 200) return new Response("Arquivo n\xE3o encontrado", { status: 404 });
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "application/vnd.android.package-archive");
      headers.set("Content-Disposition", 'attachment; filename="' + filename + '"');
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(asset.body, { status: 200, headers });
    }
    if (!env.JOTAFY_TOKEN) return reply2({ error: "Monitor n\xE3o configurado" }, 503);
    if (!await authenticated(req, env)) return reply2({ error: "Acesso n\xE3o autorizado" }, 401);
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/push/")) {
        const response = await technicalRoute(req, env);
        if (response) return response;
      }
      if (url.pathname === "/devices" && req.method === "POST") {
        if (!configured(env)) return reply2({ error: "Push aguardando configura\xE7\xE3o Firebase", code: "firebase_not_configured" }, 503);
        if (Number(req.headers.get("Content-Length")) > 8192) return reply2({ error: "Dados inv\xE1lidos" }, 413);
        const raw2 = await req.text();
        if (raw2.length > 8192) return reply2({ error: "Dados inv\xE1lidos" }, 413);
        let data, prefs;
        try {
          data = JSON.parse(raw2);
          prefs = preferences(data.preferences);
        } catch {
          return reply2({ error: "Prefer\xEAncias inv\xE1lidas" }, 400);
        }
        if (data.firebaseProjectId !== env.FCM_PROJECT_ID || !["com.jotafy.app", "com.jotafy.app.preview"].includes(data.applicationId)) return reply2({ error: "Aplicativo e servidor devem usar o mesmo projeto Firebase", code: "firebase_project_mismatch" }, 400);
        if (!/^[a-f0-9-]{36}$/i.test(data.installationId || "") || typeof data.fcmToken !== "string" || data.fcmToken.length < 20 || data.fcmToken.length > 4096 || /\s/.test(data.fcmToken)) return reply2({ error: "Dispositivo inv\xE1lido" }, 400);
        const now2 = Date.now(), auth = await hash(env.JOTAFY_TOKEN), tokenHash = await hash(data.fcmToken);
        const old = await env.DB.prepare("SELECT id FROM jotafy_devices WHERE token_hash=? AND id<>?").bind(tokenHash, data.installationId).first();
        if (old) return reply2({ error: "Token j\xE1 associado a outro dispositivo" }, 409);
        const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM jotafy_devices WHERE active=1 AND auth_hash=? AND id<>?").bind(auth, data.installationId).first();
        if (count.n >= 20) return reply2({ error: "Limite de dispositivos atingido" }, 429);
        const max = await env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM jotafy_events").first();
        await env.DB.prepare("INSERT INTO jotafy_devices(id,auth_hash,token_hash,token_cipher,preferences,registered_after,enqueued_through,registered_at,updated_at,application_id,active) VALUES(?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET auth_hash=excluded.auth_hash,token_hash=excluded.token_hash,token_cipher=excluded.token_cipher,preferences=excluded.preferences,application_id=excluded.application_id,updated_at=excluded.updated_at,registered_after=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.registered_after ELSE jotafy_devices.registered_after END,enqueued_through=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.enqueued_through ELSE jotafy_devices.enqueued_through END,registered_at=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.registered_at ELSE jotafy_devices.registered_at END,active=1").bind(data.installationId, auth, tokenHash, await encryptToken(env, data.fcmToken), JSON.stringify(prefs), max.seq, max.seq, now2, now2, data.applicationId).run();
        return reply2({ registered: true, deviceId: data.installationId, push: "configured" });
      }
      if (url.pathname === "/devices" && req.method === "GET") {
        const rows = await env.DB.prepare("SELECT id,registered_at,updated_at,preferences FROM jotafy_devices WHERE active=1 AND auth_hash=? ORDER BY updated_at DESC").bind(await hash(env.JOTAFY_TOKEN)).all();
        return reply2({ devices: rows.results.map((r) => ({ ...r, preferences: JSON.parse(r.preferences) })) });
      }
      if (url.pathname.startsWith("/devices/") && req.method === "DELETE") {
        const id = url.pathname.slice(9);
        await env.DB.batch([env.DB.prepare("DELETE FROM jotafy_outbox WHERE device_id IN (SELECT id FROM jotafy_devices WHERE id=? AND auth_hash=?)").bind(id, await hash(env.JOTAFY_TOKEN)), env.DB.prepare("DELETE FROM jotafy_devices WHERE id=? AND auth_hash=?").bind(id, await hash(env.JOTAFY_TOKEN))]);
        return reply2({ removed: true });
      }
      if (req.method !== "GET") return reply2({ error: "M\xE9todo n\xE3o permitido" }, 405);
      if (/^\/events\/[1-9][0-9]*$/.test(url.pathname)) {
        const event = await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN platform_all_orders o ON o.id=e.order_id WHERE e.seq=? AND o.environment='production'").bind(Number(url.pathname.split("/")[2])).first();
        return event ? reply2({ event }) : reply2({ error: "Evento n\xE3o encontrado" }, 404);
      }
      if (url.pathname !== "/dashboard") return reply2({ error: "N\xE3o encontrado" }, 404);
      const days = Number(url.searchParams.get("days") || 1);
      if (![1, 7, 30].includes(days)) return reply2({ error: "Per\xEDodo inv\xE1lido" }, 400);
      const now = Date.now(), local = new Date(now - 108e5);
      const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 108e5 - (days - 1) * 864e5;
      const filter = " FROM platform_all_orders o WHERE o.environment='production' AND o.status='approved' AND o.approved_at>=? AND o.approved_at<=?";
      const statements = [
        env.DB.prepare("SELECT COUNT(*) AS sales,COALESCE(SUM(o.amount_cents),0) AS revenue" + filter).bind(start, now),
        env.DB.prepare("SELECT COALESCE((SELECT e.method FROM jotafy_events e WHERE e.order_id=o.id AND e.kind='approved' ORDER BY seq DESC LIMIT 1),'unknown') AS method,COUNT(*) AS sales,SUM(o.amount_cents) AS revenue" + filter + " GROUP BY method ORDER BY sales DESC").bind(start, now),
        env.DB.prepare("SELECT strftime('%Y-%m-%d',o.approved_at/1000,'unixepoch','-3 hours') AS date,COUNT(*) AS sales,SUM(o.amount_cents) AS revenue" + filter + " GROUP BY date ORDER BY date").bind(start, now),
        env.DB.prepare("SELECT COALESCE(MAX(seq),0) AS seq FROM jotafy_events")
      ];
      const [summaries, methods, daysRows, maxRows] = await env.DB.batch(statements);
      const raw = url.searchParams.get("after"), after = raw === null ? Number(maxRows.results[0].seq) : Number(raw);
      if (!Number.isSafeInteger(after) || after < 0) return reply2({ error: "Cursor inv\xE1lido" }, 400);
      const events = await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN platform_all_orders o ON o.id=e.order_id WHERE e.seq>? AND o.environment='production' ORDER BY e.seq LIMIT 100").bind(after).all();
      const recent = await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN platform_all_orders o ON o.id=e.order_id WHERE o.environment='production' ORDER BY e.seq DESC LIMIT 25").all();
      const daily = Array.from({ length: days }, (_, i) => {
        const date = new Date(start - 108e5 + i * 864e5).toISOString().slice(0, 10);
        return daysRows.results.find((row) => row.date === date) || { date, sales: 0, revenue: 0 };
      });
      return reply2({ days, start, end: now, timezone: "America/Sao_Paulo", summary: summaries.results[0], methods: methods.results, daily, recent: recent.results, events: events.results, cursor: events.results.at(-1)?.seq ?? after, push: { configured: configured(env) } });
    } catch {
      return reply2({ error: "N\xE3o foi poss\xEDvel consultar o monitor. Tente novamente." }, 503);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await dispatch(env);
        await dispatchTechnical(env);
      } catch {
        console.warn(JSON.stringify({ event: "jotafy_push", stage: "dispatch_unavailable" }));
      }
    })());
  }
};
export {
  worker_default as default
};
// Adapted from the verified live Jotafy worker a6d58cd6; only unified-ledger SQL changed.
