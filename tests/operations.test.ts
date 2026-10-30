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
let mf: Miniflare;
let runtime: any;
before(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: "export default {fetch(){return new Response()}}",
      compatibilityDate: "2026-10-27",
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
});
after(async () => await mf.dispose());
function cookie() {
  const value = "a".repeat(32) + "." + (Date.now() + 3600000);
  return (
    "__Host-recipe-support=" +
    value +
    "." +
    createHmac("sha256", runtime.EBOOK_ADMIN_KEY).update(value).digest("hex")
  );
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
  assert.throws(() =>
    reportFilter(new URLSearchParams("start=2026-10-30&end=2026-01-01")),
  );
  assert.throws(() => reportFilter(new URLSearchParams("status=madeup")));
  assert.equal(reportFilter(new URLSearchParams("page=-3")).page, 1);
});
test("operator password login uses salted hash, supports seven days and requires current password for changes", async () => {
  const { saveAccount, accountLogin } = await import("../lib/operator-login");
  const { verifyAccessAdmin } = await import("../lib/access-admin");
  await saveAccount(runtime, "support:fixture", {
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
  assert.match(verifyAccessAdmin(runtime, result.session), /^support:/);
  await assert.rejects(() =>
    saveAccount(runtime, "support:fixture", {
      email: "attacker@example.com",
      password: "replacement-password-123",
    }),
  );
  await saveAccount(runtime, "support:fixture", {
    email: "owner@example.com",
    password: "replacement-password-123",
    currentPassword: "fixture-password-12345",
  });
  await assert.rejects(() =>
    accountLogin(
      runtime,
      { email: "owner@example.com", password: "fixture-password-12345" },
      "fixture-ip",
    ),
  );
});
