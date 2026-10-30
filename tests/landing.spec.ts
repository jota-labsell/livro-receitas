import { test, expect } from "@playwright/test";
test("requested purchase sequence, real testimonials, premium benefits and checkout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/orders/status", route => route.fulfill({ status: 404, json: { error: "No fixture order" } }));
  await page.route("**/api/checkout", route => route.fulfill({ json: { available: false } }));
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
  const missingSession = await request.get("/api/download", { maxRedirects: 0 });
  expect(missingSession.status()).toBe(303);
  expect(missingSession.headers().location).toContain("/acesso?estado=session");
  expect(
    (
      await request.get("/api/download", {
          maxRedirects: 0,
        headers: { cookie: "ebook-access=9999999999999.fake" },
      })
    ).status(),
  ).toBe(303);
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
test("SDK is reused and Brick teardown finishes before remount", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { constructors: 0, creates: 0, active: 0, maxActive: 0 };
    (window as any).__sdkMetrics = metrics;
    window.MercadoPago = class {
      constructor() { metrics.constructors++; }
      bricks() { return { create: async (_type: string, id: string) => {
        metrics.creates++; metrics.active++;
        metrics.maxActive = Math.max(metrics.maxActive, metrics.active);
        await new Promise(resolve => setTimeout(resolve, 150));
        document.getElementById(id)!.textContent = "Cartão simulado";
        return { unmount: async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
          document.getElementById(id)?.replaceChildren(); metrics.active--;
        } };
      } }; }
    } as any;
  });
  await page.route("**/api/checkout", route => route.fulfill({ json: route.request().method() === "GET"
    ? { available: true, publicKey: "TEST", amount: 10, paymentMethods: { creditCard: "all", bankTransfer: "all" } }
    : { ready: true } }));
  await page.route("**/api/orders/status", route => route.fulfill({ json: { status: "created" } }));
  await page.goto("/");
  await page.locator(".initial-offer .button").click();
  await expect.poll(() => page.evaluate(() => (window as any).__sdkMetrics.creates)).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("radio", { name: "Pix", exact: true }).check();
    await page.getByRole("radio", { name: "Cartão de crédito", exact: true }).check();
  }
  await expect(page.getByText("Cartão simulado", { exact: true })).toBeVisible();
  const metrics = await page.evaluate(() => (window as any).__sdkMetrics);
  expect(metrics.constructors).toBe(1);
  expect(metrics.maxActive).toBe(1);
  expect(metrics.active).toBe(1);
});

test("Pix validates email, handles failure, blocks repeats and follows server approval", async ({ page }) => {
  let submissions = 0;
  let status = "created";
  await page.addInitScript(() => {
    window.MercadoPago = class {
      bricks() { return { create: async (_type: string, id: string) => {
        document.getElementById(id)!.textContent = "Campos de cartão simulados";
        return { unmount: async () => { document.getElementById(id)?.replaceChildren(); } };
      } }; }
    } as any;
  });
  await page.route("**/api/checkout", route => route.fulfill({ json: route.request().method() === "GET"
    ? { available: true, publicKey: "TEST", amount: 10, paymentMethods: { creditCard: "all", bankTransfer: "all" } }
    : { ready: true } }));
  await page.route("**/api/orders/status", route => route.fulfill({ json: { status } }));
  await page.route("**/api/payments", async route => {
    submissions++;
    await new Promise(resolve => setTimeout(resolve, 300));
    if (submissions === 1) return route.fulfill({ status: 502, json: { error: "Falha simulada da API" } });
    status = "pending";
    return route.fulfill({ json: { status, pix: { code: "FIXTURE-SEM-VALOR-DE-PAGAMENTO", qrCodeBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=" } } });
  });
  await page.goto("/");
  await page.locator(".initial-offer .button").click();
  await page.getByRole("radio", { name: "Pix", exact: true }).check();
  await expect(page.getByText("Campos de cartão simulados")).not.toBeVisible();
  await expect(page.getByRole("radio", { name: /débito/i })).toHaveCount(0);
  const email = page.getByLabel("E-mail", { exact: true });
  const submit = page.getByRole("button", { name: "Gerar Pix de R$ 10,00" });
  await email.fill("invalido"); await submit.click();
  expect(submissions).toBe(0);
  await email.fill("fixture@example.com"); await submit.click();
  await expect(page.locator(".payment-area").getByRole("alert")).toHaveText("Falha simulada da API");
  await submit.click();
  await expect(page.getByRole("button", { name: "Gerando Pix…" })).toBeDisabled();
  await expect(page.getByLabel("Pix copia e cola")).toHaveValue("FIXTURE-SEM-VALOR-DE-PAGAMENTO");
  await expect(page.getByAltText("QR Code Pix do seu pedido")).toBeVisible();
  expect(submissions).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" })).toHaveCount(0);
  status = "approved";
  await page.getByRole("button", { name: "Consultar status do pagamento" }).click();
  await expect(page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" })).toBeVisible();
});

for (const status of ["approved", "pending", "rejected"])
  test(`checkout displays ${status} from backend and prevents double submission`, async ({
    page,
  }) => {
    let submissions = 0;
    let releasePayment!: () => void;
    const paymentResponseReady = new Promise<void>(resolve => { releasePayment = resolve; });
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
                style.textContent = ".provider-title-fixture { font-size: 20px; letter-spacing: normal; line-height: 1.6; }";
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
                settings.callbacks.onReady();
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
      await paymentResponseReady;
      await route.fulfill({ json: { status, paymentId: null, providerOrderId: "ORDfixture", ...(status === "pending" ? { pix: { code: "pix-fixture-copy-code" } } : {}) } });
    });
    await page.goto("/");
    await page.locator(".initial-offer .button").click();
    await expect.poll(() => page.evaluate(() => (window as any).__brickVisual?.defaultPaymentOption?.creditCardForm)).toBe(true);
    expect(await page.evaluate(() => (window as any).__brickVisual.style.customVariables.formPadding)).toBe("16px");
    await expect(page.locator(".provider-title-fixture")).toHaveCSS("font-size", "20px");
    await expect(page.locator(".provider-title-fixture")).toHaveCSS("letter-spacing", "normal");
    await expect(page.locator(".provider-title-fixture")).toHaveCSS("line-height", "32px");
    const field = await page.getByRole("textbox", { name: "Campo de teste do formulário" }).boundingBox();
    const host = await page.locator("#payment-brick").boundingBox();
    expect(host!.width).toBeGreaterThanOrEqual(280);
    expect(field!.x).toBeGreaterThanOrEqual(host!.x);
    expect(field!.x + field!.width).toBeLessThanOrEqual(host!.x + host!.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page
      .getByRole("button", { name: "Pagar no teste de interface" })
      .click();
    await expect(
      page.getByText("Processando sua solicitação. Aguarde a confirmação."),
    ).toBeVisible();
    releasePayment();
    if (status === "approved")
      await expect(
        page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" }),
      ).toBeVisible();
    if (status === "pending") {
      await expect(page.getByLabel("Pix copia e cola")).toHaveValue("pix-fixture-copy-code");
      await expect(
        page.getByText("Seu pagamento aguarda confirmação."),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "BAIXAR MEU E-BOOK AGORA" }),
      ).toHaveCount(0);
    }
    if (status === "rejected")
      await expect(
        page.getByRole("button", { name: "Tentar novamente" }),
      ).toBeVisible();
    expect(submissions).toBe(1);
  });


// Meta SDK doubles verify automatic tracking and deduplication through the exclusive screen.
test('Meta automatic production purchase survives exclusive screen and reload without duplicates', async ({ page }) => {
  const calls: any[][] = [];
  let status = 'created';
  const purchase={eventId:'a'.repeat(64),value:10,currency:'BRL'};
  await page.exposeFunction('__recordMeta', (...args: any[]) => { calls.push(args); });
  await page.route('https://connect.facebook.net/**', route => route.fulfill({ contentType:'application/javascript', body:'const f=window.fbq;f.callMethod=(...a)=>window.__recordMeta(...a);for(const a of f.queue)f.callMethod(...a);f.queue=[];' }));
  await page.route('**/api/marketing', route => route.fulfill({json:{enabled:true}}));
  await page.route('**/api/checkout', route => route.fulfill({json:route.request().method()==='GET'?{available:true,publicKey:'TEST',amount:10,paymentMethods:{creditCard:'all'},mode:'production'}:{ready:true}}));
  await page.route('**/api/orders/status', route => route.fulfill({json:{status,...(status==='approved'?{purchase}:{})}}));
  await page.route('**/api/payments', route => { status='approved'; return route.fulfill({json:{status,purchase}}); });
  await page.addInitScript(() => {
    window.MercadoPago=class {bricks(){return {create:async (_type:string,id:string,settings:any)=>{
      const host=document.getElementById(id)!;
      const button=document.createElement('button');
      button.textContent='Meta purchase fixture';
      button.onclick=()=>{void settings.callbacks.onSubmit({formData:{fixture:true}});};
      host.appendChild(button);
      return {unmount:async()=>{host.replaceChildren();}};
    }}}} as any;
  });
  await page.goto('/');
  await expect.poll(()=>calls.some(c=>c[0]==='trackSingle'&&c[2]==='ViewContent')).toBe(true);
  await page.locator('#checkout').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Meta purchase fixture'}).click();
  await expect(page.getByRole('link',{name:'BAIXAR MEU E-BOOK AGORA'})).toBeVisible();
  await expect.poll(()=>calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Purchase').length).toBe(1);
  for (const event of ['PageView','ViewContent','InitiateCheckout'])
    await expect.poll(()=>calls.some(c=>c[0]==='trackSingle'&&c[2]===event)).toBe(true);
  const sent=calls.find(c=>c[2]==='Purchase')!;
  expect(sent[1]).toBe('1150409944170993');
  expect(sent[3].value).toBe(10); expect(sent[3].currency).toBe('BRL');
  expect(sent[4].eventID).toBe(purchase.eventId);
  await page.reload();
  await expect(page.getByRole('link',{name:'BAIXAR MEU E-BOOK AGORA'})).toBeVisible();
  await expect.poll(()=>calls.filter(c=>c[2]==='PageView').length).toBe(2);
  expect(calls.filter(c=>c[2]==='Purchase').length).toBe(1);
});

test('Meta stays disabled in sandbox', async ({ page }) => {
  let scripts=0;
  await page.route('https://connect.facebook.net/**',route=>{scripts++;return route.fulfill({body:''});});
  await page.route('**/api/marketing',route=>route.fulfill({json:{enabled:false}}));
  await page.route('**/api/orders/status',route=>route.fulfill({status:404,json:{error:'No fixture order'}}));
  await page.goto('/');
  await expect(page.locator('#oferta')).toBeVisible();
  await expect(page.getByRole('complementary',{name:'Preferência de medição dos anúncios'})).toHaveCount(0);
  expect(scripts).toBe(0);
});
