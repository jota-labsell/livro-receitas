import { test, expect, type Page } from "@playwright/test";

const fixtureCode = "FIXTURE-SEM-VALOR-DE-PAGAMENTO-".repeat(8);
async function checkout(page: Page, status = "created") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // All payments are intercepted. The image is a 1px fixture, not a payable QR.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => {
        if ((window as any).__clipboardFails) throw Error("Clipboard fixture failure");
        (window as any).__copiedCode = value;
      },
    } });
    window.MercadoPago = class {
      bricks() { return { create: async (_type: string, id: string, settings: any) => {
        (window as any).__uiVisual = settings.customization.visual;
        (window as any).__brickOnError = settings.callbacks.onError;
        const host = document.getElementById(id)!;
        const label = document.createElement("label");
        label.textContent = "Nome no cartão (simulado)";
        const input = document.createElement("input");
        input.style.cssText = "display:block;width:100%;min-height:48px;border:1px solid #6b8173;border-radius:9px;padding:12px;margin:8px 0 20px";
        label.appendChild(input); host.appendChild(label);
        const button = document.createElement("button");
        button.textContent = "Pagar R$ 10,00 (simulado)";
        button.style.cssText = `width:100%;min-height:48px;border-radius:9px;padding:14px;background:${settings.customization.visual.style.customVariables.baseColor};color:white`;
        host.appendChild(button);
        return { unmount: async () => { host.replaceChildren(); } };
      } }; }
    } as any;
  });
  await page.route("**/api/checkout", route => route.fulfill({ json: route.request().method() === "GET"
    ? { available: true, publicKey: "TEST-UI", amount: 10, paymentMethods: { creditCard: "all", bankTransfer: "all" } }
    : { ready: true } }));
  await page.route("**/api/orders/status", route => route.fulfill({ json: { status, ...(status === "pending" ? { pix: {
    code: fixtureCode,
    qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=",
  } } : {}) } }));
  await page.route("**/api/payments", route => route.abort());
  await page.route("**/api/events", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await page.locator(".initial-offer .button").click();
  await expect(page.getByRole("heading", { name: "Conclua sua compra" })).toBeVisible();
  await expect(page.getByText("Carregando o pagamento…", { exact: true })).not.toBeVisible();
}

function contrast(a: string, b: string) {
  const luminance = (rgb: string) => {
    const c = rgb.match(/[\d.]+/g)!.slice(0, 3).map(v => Number(v) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test("green theme stays inside checkout; sections, touch targets, focus and contrast are accessible", async ({ page }) => {
  await checkout(page);
  await expect(page.getByRole("group", { name: "Forma de pagamento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo do pedido" })).toBeVisible();
  await expect(page.getByLabel("Nome no cartão (simulado)")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__uiVisual.style.customVariables.baseColor)).toBe("#166534");
  const heroColor = await page.locator(".initial-offer .button").evaluate(el => getComputedStyle(el).backgroundColor);
  const pix = page.getByRole("radio", { name: "Pix", exact: true });
  await pix.focus(); await page.keyboard.press("Space");
  await expect(pix).toBeChecked();
  const selected = pix.locator("..");
  await expect(selected).toHaveCSS("outline-width", "3px");
  for (const label of await page.locator(".payment-methods label").all()) {
    const box = await label.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const button = page.getByRole("button", { name: "Gerar Pix de R$ 10,00" });
  const colors = await button.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
  expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(colors.background).toBe("rgb(22, 101, 52)");
  expect(heroColor).not.toBe(colors.background);
  expect(await page.locator("#oferta").evaluate(el => getComputedStyle(el).getPropertyValue("--checkout-primary").trim())).toBe("");
  await expect(button).toHaveCSS("min-height", "48px");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const panel = await page.locator(".payment-area").boundingBox();
  const input = await page.getByLabel("E-mail", { exact: true }).boundingBox();
  expect(input!.x).toBeGreaterThan(panel!.x);
  expect(input!.x + input!.width).toBeLessThan(panel!.x + panel!.width);
});

test("card field non-critical SDK errors do not appear as payment failures", async ({ page }) => {
  await checkout(page);
  await expect(page.getByLabel("Nome no cartão (simulado)")).toBeVisible();
  await page.evaluate(() => (window as any).__brickOnError({ type: "non_critical", cause: "invalid_card_number" }));
  await expect(page.locator(".payment-error")).toHaveCount(0);
  await page.evaluate(() => (window as any).__brickOnError({ type: "critical", cause: "fields_setup_failed" }));
  await expect(page.locator(".payment-error")).toContainText("Não foi possível carregar o campo seguro do cartão");
  await expect(page.getByRole("button", { name: "Carregar pagamento novamente" })).toBeVisible();
});

test("Pix copy is a visible button with temporary feedback and manual fallback", async ({ page }) => {
  await checkout(page, "pending");
  const copy = page.getByRole("button", { name: "Copiar código Pix (copia e cola)", exact: true });
  await expect(copy).toBeVisible();
  await expect(copy).toHaveCSS("border-top-width", "1px");
  expect((await copy.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("Escaneie o QR Code no app do seu banco ou copie o código abaixo.")).toBeVisible();
  await copy.click();
  expect(await page.evaluate(() => (window as any).__copiedCode)).toBe(fixtureCode);
  await expect(copy).toHaveText("Copiado!");
  await expect(page.getByRole("status").filter({ hasText: "Copiado! Cole" })).toBeVisible();
  await expect(copy).toHaveText("Copiar código Pix (copia e cola)", { timeout: 5000 });
  await page.evaluate(() => { (window as any).__clipboardFails = true; });
  await copy.click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível copiar automaticamente" })).toBeVisible();
  const code = page.getByLabel("Pix copia e cola");
  await expect(code).toBeFocused();
  expect(await code.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(fixtureCode.length);
  await expect(page.getByRole("button", { name: "Gerar Pix de R$ 10,00" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const state of ["card", "pix-form", "pix-pending"]) {
  test(`checkout visual: ${state}`, async ({ page }) => {
    await checkout(page, state === "pix-pending" ? "pending" : "created");
    if (state === "pix-form") await page.getByRole("radio", { name: "Pix", exact: true }).check();
    if (state === "card") await expect(page.getByLabel("Nome no cartão (simulado)")).toBeVisible();
    if (state === "pix-pending") await expect(page.getByLabel("Pix copia e cola")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#checkout")!.scrollIntoView({ block: "start", behavior: "instant" });
    });
    await expect(page.locator("#checkout")).toHaveScreenshot(`${state}.png`, { animations: "disabled" });
  });
}
