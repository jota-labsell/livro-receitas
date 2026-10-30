import { test, expect } from "@playwright/test";

test("product access: missing session provides functional link recovery and support without asking to pay again", async ({ page }) => {
  await page.route("**/api/product-access", r => r.fulfill({ status: 401, json: { state: "session" } }));
  await page.goto("/acesso");
  await expect(page.getByRole("heading", { name: "Precisamos recuperar seu acesso" })).toBeVisible();
  await expect(page.getByText("Não é necessário pagar novamente.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "receitaspremium150@gmail.com" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recuperar com meu link" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("recover-access.png"), fullPage: true });
});
test("product access: preview does not redeem; explicit interaction establishes access and survives reload", async ({ page }) => {
  let redeemed = false, posts = 0;
  const token = "a".repeat(64);
  await page.route("**/api/product-access", async r => {
    if (r.request().method() === "POST") { posts++; expect(r.request().postDataJSON().token).toBe(token); redeemed = true; }
    return r.fulfill({ status: redeemed ? 200 : 401, json: { state: redeemed ? "approved" : "session" } });
  });
  await page.goto(`/acesso#token=${token}`);
  await expect(page.getByRole("button", { name: "Validar meu acesso" })).toBeVisible();
  expect(posts).toBe(0);
  await expect(page).toHaveURL(/\/acesso$/);
  await page.getByRole("button", { name: "Validar meu acesso" }).click();
  await expect(page.getByRole("heading", { name: "Seu e-book está liberado" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar meu e-book" })).toHaveAttribute("href", "/api/download");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Seu e-book está liberado" })).toBeVisible();
  expect(posts).toBe(1);
  await page.screenshot({ path: test.info().outputPath("authorized-access.png"), fullPage: true });
});
for (const [state, title] of [
  ["expired", "Seu link expirou"], ["revoked", "Link desativado"], ["invalid", "Não conseguimos validar este link"],
  ["pending", "Aguardando confirmação"], ["rejected", "Pagamento não aprovado"], ["refunded", "Pagamento reembolsado"],
  ["charged_back", "Pagamento em contestação"], ["cancelled", "Pedido cancelado"], ["storage", "Arquivo temporariamente indisponível"],
  ["verification", "Não conseguimos conferir agora"],
]) {
  test(`product access: ${state} provides a clear recovery screen`, async ({ page }) => {
    await page.route("**/api/product-access", r => r.fulfill({ status: 403, json: { state } }));
    await page.goto(`/acesso?estado=${state}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar meu e-book" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Conferir novamente" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test("product access: private link can be pasted; no pixel or marketing scripts run on access page", async ({ page }) => {
  let posted = false;
  const marketingRequests: string[] = [];
  page.on("request", request => { if (/facebook|fbevents|\/api\/marketing/.test(request.url())) marketingRequests.push(request.url()); });
  await page.route("**/api/product-access", r => {
    if (r.request().method() === "POST") { posted = true; expect(r.request().postDataJSON().token).toBe("b".repeat(64)); }
    return r.fulfill({ json: { state: posted ? "approved" : "session" } });
  });
  await page.goto("/acesso");
  await page.getByLabel("Já recebeu um link privado do atendimento?").fill(`https://example.com/acesso#token=${"b".repeat(64)}`);
  await page.getByRole("button", { name: "Recuperar com meu link" }).click();
  await expect(page.getByRole("link", { name: "Baixar meu e-book" })).toBeVisible();
  expect(marketingRequests).toHaveLength(0);
});
test("product access: server protects administrative page and APIs", async ({ page, request }) => {
  await page.goto("/admin/acesso");
  await expect(page).toHaveURL(/\/admin\/acesso\/entrar$/);
  await expect(page.getByLabel("Credencial administrativa")).toHaveAttribute("type", "password");
  const api = await request.get("/api/admin/ebook");
  expect(api.status()).toBe(401);
});
