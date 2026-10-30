import { test, expect, type Page } from "@playwright/test";

const purchase = { eventId: "a".repeat(64), value: 10, currency: "BRL" };
async function setup(page: Page, initial = "created") {
  let status = initial;
  let failStatus = false;
  let submissions = 0;
  await page.route("**/api/marketing", r => r.fulfill({ json: { enabled: false } }));
  await page.route("**/api/events", r => r.fulfill({ json: { received: true } }));
  await page.route("**/api/checkout", r => r.fulfill({ json: r.request().method() === "GET"
    ? { available: true, publicKey: "TEST", amount: 10, paymentMethods: { creditCard: "all", bankTransfer: "all" } }
    : { ready: true } }));
  await page.route("**/api/orders/status", r => r.fulfill(failStatus
    ? { status: 503, json: { error: "fixture unavailable" } }
    : { json: { status, ...(status === "approved" ? { purchase } : {}) } }));
  await page.route("**/api/payments", r => {
    submissions++;
    status = "approved";
    return r.fulfill({ json: { status, purchase } });
  });
  await page.addInitScript(() => {
    window.MercadoPago = class {
      bricks() { return { create: async (_type: string, id: string, settings: any) => {
        const host = document.getElementById(id)!;
        const button = document.createElement("button");
        button.textContent = "Payer fixture";
        button.onclick = () => { void settings.callbacks.onSubmit({ formData: { fixture: true } }); };
        host.appendChild(button);
        return { unmount: async () => { host.replaceChildren(); } };
      } }; }
    } as any;
  });
  return {
    setStatus(value: string) { status = value; },
    fail() { failStatus = true; },
    submissions: () => submissions,
  };
}
async function exclusive(page: Page) {
  const title = page.getByRole("heading", { level: 1, name: "Pagamento aprovado!", exact: true });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await expect(page).toHaveTitle("Compra confirmada | 150 Doces");
  await expect(page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" })).toHaveAttribute("href", "/api/download");
  await expect(page.locator("#oferta, #checkout, #beneficios, #por-dentro, #garantia, .mobile-cta, .product-demo, #payment-brick, details")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "receitaspremium150@gmail.com" })).toBeVisible();
  await expect(page.getByAltText("Capa do e-book 150 Doces para Comer e Vender")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const download = await page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" }).boundingBox();
  expect(download!.y + download!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}
test("post-purchase replaces the landing on card approval and recovers on reload", async ({ page }) => {
  const mock = await setup(page);
  await page.goto("/");
  await page.locator(".initial-offer .button").click();
  await page.getByRole("button", { name: "Payer fixture" }).click();
  await exclusive(page);
  await page.screenshot({ path: test.info().outputPath("post-purchase.png"), fullPage: true });
  expect(mock.submissions()).toBe(1);
  await page.reload();
  await exclusive(page);
  expect(mock.submissions()).toBe(1);
});
test("post-purchase recovers pending Pix approval without scrolling to checkout", async ({ page }) => {
  const mock = await setup(page, "pending");
  await page.goto("/");
  await expect(page.locator("#oferta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pagamento aprovado!" })).toHaveCount(0);
  await expect(page.locator('a[href="/api/download"]')).toHaveCount(0);
  mock.setStatus("approved");
  await expect(page.getByRole("heading", { name: "Pagamento aprovado!" })).toBeVisible({ timeout: 15000 });
  await exclusive(page);
  expect(mock.submissions()).toBe(0);
});
for (const status of ["pending", "processing", "rejected", "refunded", "charged_back"]) {
  test(`post-purchase never grants success for ${status} or forged browser proof`, async ({ page }) => {
    await setup(page, status);
    await page.addInitScript(() => {
      localStorage.setItem("paymentStatus", "approved");
      localStorage.setItem("purchase", JSON.stringify({ status: "approved" }));
    });
    await page.goto("/?status=approved&payment_status=approved");
    await expect(page.locator("#oferta")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pagamento aprovado!" })).toHaveCount(0);
    await expect(page.locator('a[href="/api/download"]')).toHaveCount(0);
  });
}
test("post-purchase hides success when backend is unavailable or approval was revoked", async ({ page }) => {
  const mock = await setup(page, "approved");
  await page.goto("/");
  await exclusive(page);
  mock.setStatus("refunded");
  await page.reload();
  await expect(page.locator("#oferta")).toBeVisible();
  await expect(page.locator('a[href="/api/download"]')).toHaveCount(0);
  mock.fail();
  await page.reload();
  await expect(page.locator("#oferta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pagamento aprovado!" })).toHaveCount(0);
});
