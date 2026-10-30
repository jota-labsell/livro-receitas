import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHmac } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { NextRequest } from "next/server";
import {
  recordVisit,
  reportFilter,
  saveOperationSettings,
} from "../lib/operations";
import { operationSettings, orderPixel } from "../lib/operations-settings";
import { ensureOrder, newAccess, hash } from "../lib/commerce";
import { GET, POST } from "../app/api/admin/operations/route";
import {
  loginAccessAdmin,
  verifyAccessAdmin,
  revokeAdminSession,
} from "../lib/access-admin";
let mf: Miniflare;
let runtime: any;
let adminSession: string;
before(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: await readFile("work/operations-auth-worker.mjs", "utf8"),
      compatibilityDate: "2026-10-27",
      compatibilityFlags: ["nodejs_compat"],
      bindings: { EBOOK_ADMIN_KEY: "a".repeat(64) },
      d1Databases: ["ORDERS"],
    }),
  );
  const db = await mf.getD1Database("ORDERS");
  runtime = {
    ORDERS: db,
    MERCADOPAGO_MODE: "production",
    SITE_URL: "https://store.example",
    EBOOK_ADMIN_KEY: "a".repeat(64),
  };
  Reflect.set(globalThis, "__metaDiagnosticEnv", runtime);
  for (const file of [
    "0001_commerce.sql",
    "0002_order_environment.sql",
    "0003_jotafy.sql",
    "0007_meta_capi.sql",
    "0008_product_access.sql",
    "0009_meta_automatic.sql",
    "0010_operations.sql",
  ])
    for (const statement of (await readFile("migrations/" + file, "utf8"))
      .split(";")
      .filter((x) => x.trim()))
      await db.prepare(statement).run();
  adminSession = await loginAccessAdmin(
    runtime,
    runtime.EBOOK_ADMIN_KEY,
    "fixture-setup-ip",
  );
});
after(async () => await mf.dispose());
function cookie() {
  return "__Host-recipe-support=" + adminSession;
}
function req(
  method = "GET",
  input?: unknown,
  auth = true,
  origin = "https://store.example",
) {
  return new NextRequest("https://store.example/api/admin/operations", {
    method,
    headers: {
      ...(auth ? { cookie: cookie() } : {}),
      origin,
      "Content-Type": "application/json",
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
}
test("admin data and mutations require a valid session and same origin", async () => {
  assert.equal((await GET(req("GET", undefined, false))).status, 401);
  assert.equal(
    (
      await POST(
        req(
          "POST",
          { pixelId: "123456789", capiPaused: false },
          true,
          "https://evil.example",
        ),
      )
    ).status,
    403,
  );
});
test("attribution remains first session origin when reloaded with different UTMs; revenue is not multiplied", async () => {
  const visit = randomUUID();
  await recordVisit(runtime, visit, { source: "meta", campaign: "First" });
  await recordVisit(runtime, visit, { source: "other", campaign: "Second" });
  const order = await ensureOrder(runtime, newAccess(), visit);
  await runtime.ORDERS.prepare("UPDATE orders SET status='approved' WHERE id=?")
    .bind(order.id)
    .run();
  for (const name of ["offer_view", "cta_click", "cta_click"])
    await runtime.ORDERS.prepare(
      "INSERT INTO funnel_events(event_key,name,visit_hash,created_at) VALUES(?,?,?,?)",
    )
      .bind(randomUUID(), name, hash(visit), Date.now())
      .run();
  const result = await GET(req());
  assert.equal(result.status, 200);
  const data: any = await result.json();
  assert.equal(data.summary.revenue, 1000);
  assert.equal(data.funnel.clicks, 1);
  assert.equal(data.campaigns[0].campaign, "First");
  assert.equal(data.campaigns[0].revenue, 1000);
});
test("settings validate Pixel, log audit and keep an existing order pinned to its original Pixel", async () => {
  await assert.rejects(() =>
    saveOperationSettings(runtime, "operator", {
      pixelId: "not-a-pixel",
      capiPaused: false,
    }),
  );
  const visit = randomUUID();
  const order = await ensureOrder(runtime, newAccess(), visit);
  await runtime.ORDERS.prepare(
    "INSERT INTO operation_order_pixel(order_id,pixel_id) VALUES(?,?)",
  )
    .bind(order.id, "1150409944170993")
    .run();
  await saveOperationSettings(runtime, "operator", {
    pixelId: "123456789",
    capiPaused: true,
  });
  assert.equal((await operationSettings(runtime)).pixelId, "123456789");
  assert.equal((await operationSettings(runtime)).capiPaused, true);
  assert.equal(await orderPixel(runtime, order.id), "1150409944170993");
  assert.equal(
    (
      await runtime.ORDERS.prepare(
        "SELECT COUNT(*) n FROM operation_audit",
      ).first()
    ).n,
    1,
  );
});
test("report rejects invalid ranges and statuses and bounds pagination", () => {
  assert.throws(() => reportFilter(new URLSearchParams("start=2026-02-31")));
  assert.throws(() =>
    reportFilter(new URLSearchParams("start=2026-10-30&end=2026-01-01")),
  );
  assert.throws(() => reportFilter(new URLSearchParams("status=madeup")));
  assert.equal(reportFilter(new URLSearchParams("page=-3")).page, 1);
});
test("status, order ID and pagination filter both the rows and financial totals", async () => {
  const ids: string[] = [];
  for (let i = 0; i < 27; i++) {
    const order = await ensureOrder(runtime, newAccess(), randomUUID());
    ids.push(order.id);
    await runtime.ORDERS.prepare(
      "UPDATE orders SET status='refunded' WHERE id=?",
    )
      .bind(order.id)
      .run();
  }
  const report = async (query: string) =>
    (
      await GET(
        new NextRequest("https://store.example/api/admin/operations?" + query, {
          headers: { cookie: cookie() },
        }),
      )
    ).json() as Promise<any>;
  const first = await report("status=refunded");
  assert.equal(first.summary.orders, 27);
  assert.equal(first.summary.revenue, 0);
  assert.equal(first.summary.reversed, 27);
  assert.equal(first.orders.length, 25);
  assert.equal(first.hasMore, true);
  const second = await report("status=refunded&page=2");
  assert.equal(second.orders.length, 2);
  assert.equal(second.hasMore, false);
  assert.equal(
    new Set([...first.orders, ...second.orders].map((x) => x.id)).size,
    27,
  );
  const one = await report("q=" + ids[0]);
  assert.equal(one.orders.length, 1);
  assert.equal(one.summary.orders, 1);
  assert.equal(one.orders[0].id, ids[0]);
  const empty = await report("q=missing-order");
  assert.equal(empty.summary.orders, 0);
  assert.deepEqual(empty.orders, []);
});
test("unavailable tracking settings pause analytics safely", async () => {
  const settings = await operationSettings({
    ORDERS: {
      prepare() {
        throw new Error("database temporarily unavailable");
      },
    },
  } as any);
  assert.equal(settings.available, false);
  assert.equal(settings.capiPaused, true);
});
test("operator password login uses salted hash, supports seven days and requires current password for changes", async () => {
  const { saveAccount, accountLogin } = await import("../lib/operator-login");
  const setupActor = await verifyAccessAdmin(runtime, adminSession);
  await saveAccount(runtime, setupActor, {
    email: "owner@example.com",
    password: "fixture-password-12345",
  });
  const stored = await runtime.ORDERS.prepare(
    "SELECT * FROM operation_account WHERE id=1",
  ).first();
  assert.equal(
    JSON.stringify(stored).includes("fixture-password-12345"),
    false,
  );
  await assert.rejects(() =>
    accountLogin(
      runtime,
      { email: "owner@example.com", password: "wrong" },
      "fixture-ip",
    ),
  );
  const result = await accountLogin(
    runtime,
    {
      email: "owner@example.com",
      password: "fixture-password-12345",
      remember: true,
    },
    "fixture-ip",
  );
  assert.equal(result.lifetime, 604800);
  await assert.rejects(() => verifyAccessAdmin(runtime, adminSession));
  const passwordActor = await verifyAccessAdmin(runtime, result.session);
  assert.match(passwordActor, /^support:/);
  await assert.rejects(() =>
    saveAccount(runtime, passwordActor, {
      email: "attacker@example.com",
      password: "replacement-password-123",
    }),
  );
  const anotherSession = await accountLogin(
    runtime,
    { email: "owner@example.com", password: "fixture-password-12345" },
    "fixture-other-ip",
  );
  await saveAccount(runtime, passwordActor, {
    email: "owner@example.com",
    password: "replacement-password-123",
    currentPassword: "fixture-password-12345",
  });
  await assert.rejects(() => verifyAccessAdmin(runtime, result.session));
  await assert.rejects(() =>
    verifyAccessAdmin(runtime, anotherSession.session),
  );
  await assert.rejects(() =>
    accountLogin(
      runtime,
      { email: "owner@example.com", password: "fixture-password-12345" },
      "fixture-ip",
    ),
  );
});

test("logout revokes the server session and a copied cookie cannot be reused", async () => {
  const { accountLogin } = await import("../lib/operator-login");
  const { session, lifetime } = await accountLogin(
    runtime,
    {
      email: "owner@example.com",
      password: "replacement-password-123",
      remember: false,
    },
    "fixture-logout-ip",
  );
  assert.equal(lifetime, 3600);
  await verifyAccessAdmin(runtime, session);
  await revokeAdminSession(runtime, session);
  await assert.rejects(() => verifyAccessAdmin(runtime, session));
});
test("actual Workers runtime derives the password and verifies and revokes the session", async () => {
  const response = await mf.dispatchFetch("https://worker.example/login", {
    method: "POST",
    body: JSON.stringify({
      email: "owner@example.com",
      password: "replacement-password-123",
      remember: true,
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { lifetime: 604800, revoked: true });
});
test("source filter applies to revenue, history, chart and cohort, with nominal reversal amounts", async () => {
  adminSession = await loginAccessAdmin(
    runtime,
    runtime.EBOOK_ADMIN_KEY,
    "fixture-source-filter-ip",
  );
  for (const status of ["approved", "pending", "refunded", "charged_back"]) {
    const visit = randomUUID();
    await recordVisit(runtime, visit, {
      source: "source-filter-fixture",
      campaign: "Cohort",
    });
    const order = await ensureOrder(runtime, newAccess(), visit);
    await runtime.ORDERS.prepare("UPDATE orders SET status=? WHERE id=?")
      .bind(status, order.id)
      .run();
  }
  const request = new NextRequest(
    "https://store.example/api/admin/operations?source=source-filter-fixture",
    { headers: { cookie: cookie() } },
  );
  const response = await GET(request);
  assert.equal(response.status, 200);
  const data: any = await response.json();
  assert.equal(data.summary.orders, 4);
  assert.equal(data.summary.revenue, 1000);
  assert.equal(data.summary.pending_amount, 1000);
  assert.equal(data.summary.refunded_amount, 1000);
  assert.equal(data.summary.chargeback_amount, 1000);
  assert.equal(data.orders.length, 4);
  assert.equal(
    data.days.reduce((sum: number, d: any) => sum + d.revenue, 0),
    1000,
  );
  assert.equal(data.funnel.sessions, 4);
  assert.equal(data.campaigns.length, 1);
  assert.equal(data.campaigns[0].source, "source-filter-fixture");
  const none = await GET(
    new NextRequest(
      "https://store.example/api/admin/operations?source=no-matching-source",
      { headers: { cookie: cookie() } },
    ),
  );
  const empty: any = await none.json();
  assert.equal(empty.summary.orders, 0);
  assert.equal(empty.orders.length, 0);
  assert.equal(empty.campaigns.length, 0);
});
