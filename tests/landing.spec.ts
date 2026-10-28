import { test, expect } from "@playwright/test";
test("requested purchase sequence, real testimonials, premium benefits and checkout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Descubra.*150 receitas de doces.*Instagram.*TikTok.*renda extra!/s,
  );
  expect(
    await page
      .locator("main>section")
      .evaluateAll((nodes) => nodes.map((node) => node.id)),
  ).toEqual([
    "oferta",
    "depoimentos",
    "beneficios",
    "garantia",
    "checkout",
    "por-dentro",
  ]);
  await expect(page.locator("#oferta .product-demo")).toBeVisible();
  await expect(page.locator("#oferta .instagram-proof")).toHaveCount(0);
  await expect(page.locator("#beneficios .delivery-checklist li")).toHaveCount(
    6,
  );
  await expect(page.locator("#beneficios")).toContainText("renda extra");
  await expect(page.locator("#beneficios")).toContainText(
    "consultar no celular ou computador",
  );
  await expect(page.locator("#garantia")).toContainText("7 dias de garantia");
  await expect(page.locator("#garantia + #checkout")).toBeVisible();
  await expect(page.locator("details")).toHaveCount(3);
  await expect(page.locator(".sample")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "O que você recebe por R$ 10." }),
  ).toBeVisible();
  await expect(page.locator(".recipe-blocks article")).toHaveCount(4);
  await expect(page.locator(".demo-stage")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  const first = page.locator(".initial-offer .button");
  await expect(page.locator("#oferta + #depoimentos")).toBeVisible();
  await expect(page.locator(".instagram-prints img")).toHaveCount(3);
  const testimonial = page.getByRole("button", {
    name: "Ampliar depoimento: Cookies recheados",
  });
  await testimonial.click();
  const printModal = page.getByRole("dialog", {
    name: "Depoimento ampliado do Instagram",
  });
  await expect(printModal).toBeVisible();
  await expect(printModal.locator("img")).toHaveAttribute(
    "src",
    "/testimonials/cookies-juliana.png",
  );
  await expect
    .poll(() =>
      printModal
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(661);
  await page.keyboard.press("Escape");
  await expect(printModal).not.toBeVisible();
  await expect(testimonial).toBeFocused();
  await page.evaluate(() =>
    scrollTo(
      0,
      document.querySelector(".proof")!.getBoundingClientRect().top +
        scrollY +
        80,
    ),
  );
  if (test.info().project.name !== "desktop")
    await expect(page.locator(".mobile-cta")).toBeVisible();
  await page.locator(".sample").first().click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(modal.locator("img")).toHaveAttribute(
    "src",
    "/ebook/page-2.webp",
  );
  await modal.getByRole("button", { name: "Próxima →" }).click();
  await expect(modal.locator("img")).toHaveAttribute(
    "src",
    "/ebook/page-3.webp",
  );
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/#checkout$/);
  await expect(page.locator(".mobile-cta")).toHaveCount(0);
  await expect(
    page.getByText("O pagamento está temporariamente indisponível.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Existe mensalidade?" })
    .click();
  await expect(page.locator("details[open]")).toContainText("R$ 10,00");
  await page.screenshot({
    path: `work/screenshots/checkout-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/");
  await page.screenshot({
    path: `work/screenshots/storefront-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/termos");
  await expect(page.locator("main")).toContainText("R$ 10,00");
  await expect(page.locator("main")).toContainText("Garantia de 7 dias");
  await page.goto("/privacidade");
  await expect(page.locator("main")).toContainText("Não contêm nome, e-mail");
  expect(errors).toEqual([]);
});
test("delivery fails closed and free access is gone", async ({ request }) => {
  expect((await request.get("/api/download")).status()).toBe(401);
  expect(
    (
      await request.get("/api/download", {
        headers: { cookie: "ebook-access=9999999999999.fake" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/access", {
        data: { name: "Test", email: "test@example.com" },
      })
    ).status(),
  ).toBe(410);
  expect(
    (
      await request.post("/api/payments", {
        headers: {
          origin: process.env.TEST_BASE_URL || "http://localhost:3000",
        },
        data: { status: "approved", amount: 0 },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/webhooks/mercadopago", {
        data: { status: "approved" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/payments", {
        headers: { origin: "https://wrong.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/private/150-doces.pdf")).status()).toBe(404);
});
test("working native MP4 plays, pauses, resumes and has GIF fallback", async ({ page, request }) => {
  await page.goto("/");
  const video = page.locator(".product-demo video");
  await expect(video).toHaveAttribute("autoplay", "");
  await expect(video).toHaveAttribute("loop", "");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video.locator("source")).toHaveAttribute("src", "/product-video/1027-loop.mp4");
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.muted && v.videoWidth > 0 && !v.paused && v.currentTime > 0)).toBe(true);
  const start = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(start);
  await page.getByRole("button", { name: "Pausar vídeo", exact: true }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.getByRole("button", { name: "Reproduzir vídeo", exact: true }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
  const response = await request.get("/product-video/1027-loop.mp4");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("video/mp4");
  await video.dispatchEvent("error");
  await expect(page.locator(".product-demo img")).toHaveAttribute("src", "/product-video/1027-loop.gif");
});
test("blocked autoplay offers manual play", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/product-video/1027-loop.mp4", async route => { await gate; await route.continue(); });
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let blocked = true;
    HTMLMediaElement.prototype.play = function () {
      if (blocked) { blocked = false; return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError")); }
      return play.call(this);
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const play = page.getByRole("button", { name: "▶ Reproduzir prévia", exact: true });
  await expect(play).toBeVisible();
  await play.click();
  release();
  await expect.poll(() => page.locator(".product-demo video").evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)).toBe(true);
  await expect(play).toHaveCount(0);
});
// SDK and API doubles below exercise UI states only. They are not Mercado Pago sandbox validation.
for (const status of ["approved", "pending", "rejected"])
  test(`checkout displays ${status} from backend and prevents double submission`, async ({
    page,
  }) => {
    let submissions = 0;
    await page.addInitScript(() => {
      window.MercadoPago = class {
        bricks() {
          return {
            create: async (type: string, id: string, settings: any) => {
              const root = document.getElementById(id)!;
              if (type === "payment") {
                (window as any).__brickVisual = settings.customization.visual;
                const title = document.createElement("h2");
                title.className = "provider-title-fixture";
                title.textContent = "Pagamento";
                const style = document.createElement("style");
                style.textContent = ".provider-title-fixture { font-size: 20px; letter-spacing: normal; }";
                root.appendChild(style);
                root.appendChild(title);
                const field = document.createElement("input");
                field.setAttribute("aria-label", "Campo de teste do formulário");
                field.style.width = "100%";
                root.appendChild(field);
                const button = document.createElement("button");
                button.textContent = "Pagar no teste de interface";
                button.onclick = () =>
                  void settings.callbacks.onSubmit({
                    formData: { test: true },
                  });
                root.appendChild(button);
              } else root.textContent = "Instruções do provedor de teste";
              return {
                unmount: async () => {
                  root.replaceChildren();
                },
              };
            },
          };
        }
      } as any;
    });
    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        json:
          route.request().method() === "GET"
            ? {
                available: true,
                publicKey: "TEST",
                amount: 10,
                paymentMethods: { creditCard: "all" },
              }
            : { ready: true },
      }),
    );
    await page.route("**/api/orders/status", (route) =>
      route.fulfill({ json: { status: "created" } }),
    );
    await page.route("**/api/payments", async (route) => {
      submissions++;
      await new Promise((r) => setTimeout(r, 250));
      await route.fulfill({ json: { status, paymentId: null, providerOrderId: "ORDfixture", ...(status === "pending" ? { pix: { code: "pix-fixture-copy-code" } } : {}) } });
    });
    await page.goto("/");
    await page.locator(".initial-offer .button").click();
    await expect.poll(() => page.evaluate(() => (window as any).__brickVisual?.defaultPaymentOption?.creditCardForm)).toBe(true);
    expect(await page.evaluate(() => (window as any).__brickVisual.style.customVariables.formPadding)).toBe("0px");
    await expect(page.locator(".provider-title-fixture")).toHaveCSS("font-size", "20px");
    await expect(page.locator(".provider-title-fixture")).toHaveCSS("letter-spacing", "normal");
    const field = await page.getByRole("textbox", { name: "Campo de teste do formulário" }).boundingBox();
    const host = await page.locator("#payment-brick").boundingBox();
    expect(field!.x).toBeGreaterThanOrEqual(host!.x);
    expect(field!.x + field!.width).toBeLessThanOrEqual(host!.x + host!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page
      .getByRole("button", { name: "Pagar no teste de interface" })
      .click();
    await expect(
      page.getByText("Processando sua solicitação. Aguarde a confirmação."),
    ).toBeVisible();
    if (status === "approved")
      await expect(
        page.getByRole("link", { name: "BAIXAR AS 150 RECEITAS" }),
      ).toBeVisible();
    if (status === "pending") {
      await expect(page.getByLabel("Pix copia e cola")).toHaveValue("pix-fixture-copy-code");
      await expect(
        page.getByText("Seu pagamento aguarda confirmação."),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "BAIXAR AS 150 RECEITAS" }),
      ).toHaveCount(0);
    }
    if (status === "rejected")
      await expect(
        page.getByRole("button", { name: "Tentar novamente" }),
      ).toBeVisible();
    expect(submissions).toBe(1);
  });


// Meta SDK double checks our event contract; Events Manager delivery is a separate check.
test('Meta consent, approved production receipt and reload deduplication', async ({ page }) => {
  const calls: any[][] = [];
  await page.exposeFunction('__recordMeta', (...args: any[]) => { calls.push(args); });
  await page.route('https://connect.facebook.net/**', route => route.fulfill({ contentType:'application/javascript', body:'const f=window.fbq;f.callMethod=(...a)=>window.__recordMeta(...a);for(const a of f.queue)f.callMethod(...a);f.queue=[];' }));
  await page.route('**/api/marketing', route => route.fulfill({json:{enabled:true}}));
  await page.route('**/api/checkout', route => route.fulfill({json:route.request().method()==='GET'?{available:true,publicKey:'TEST',amount:10,paymentMethods:{creditCard:'all'},mode:'production'}:{ready:true}}));
  const purchase={eventId:'a'.repeat(64),value:10,currency:'BRL'};
  await page.route('**/api/orders/status', route => route.fulfill({json:{status:'approved',purchase}}));
  await page.addInitScript(() => { (window as any).MercadoPago=class {bricks(){return {create:async()=>({unmount:async()=>{}})}}}; });
  await page.goto('/');
  await expect(page.getByRole('complementary', {name:'Preferência de medição dos anúncios'})).toBeVisible();
  expect(calls).toEqual([]);
  await page.getByRole('button',{name:'Permitir',exact:true}).click();
  await page.locator('#checkout').scrollIntoViewIfNeeded();
  await expect(page.getByRole('link',{name:'BAIXAR AS 150 RECEITAS'})).toBeVisible();
  await expect.poll(()=>calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Purchase').length).toBe(1);
  const sent=calls.find(c=>c[2]==='Purchase')!;
  expect(sent[1]).toBe('1150409944170993');expect(sent[3].value).toBe(10);expect(sent[3].currency).toBe('BRL');expect(sent[4].eventID).toBe(purchase.eventId);
  expect(JSON.stringify(sent)).not.toMatch(/email|payer|token|card_number|first_name/);
  await page.reload();await page.locator('#checkout').scrollIntoViewIfNeeded();
  await expect(page.getByRole('link',{name:'BAIXAR AS 150 RECEITAS'})).toBeVisible();
  expect(calls.filter(c=>c[2]==='Purchase').length).toBe(1);
});
test('Meta stays disabled in sandbox and can be declined in production', async ({ page }) => {
  let scripts=0;await page.route('https://connect.facebook.net/**',route=>{scripts++;return route.fulfill({body:''});});
  await page.route('**/api/marketing',route=>route.fulfill({json:{enabled:false}}));
  await page.goto('/');await page.locator('#checkout').scrollIntoViewIfNeeded();
  await expect(page.getByRole('complementary',{name:'Preferência de medição dos anúncios'})).toHaveCount(0);
  expect(scripts).toBe(0);
  await page.unroute('**/api/marketing');
  await page.route('**/api/marketing',route=>route.fulfill({json:{enabled:true}}));
  await page.reload();await page.getByRole('button',{name:'Não permitir',exact:true}).click();
  await page.locator('#checkout').scrollIntoViewIfNeeded();
  await page.reload();
  await expect(page.getByRole('button',{name:'Preferências de medição · desativada'})).toBeVisible();
  expect(scripts).toBe(0);
});
