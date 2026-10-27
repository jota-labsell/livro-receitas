import { test, expect } from "@playwright/test";
test("three commercial blocks, genuine previews, consistent offer, FAQ and sticky CTA", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Receba 150 receitas, dos clássicos aos doces virais do TikTok e Instagram, para fazer e vender!",
  );
  await expect(page.locator("main>section")).toHaveCount(3);
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
  await expect(page.locator(".hero h1 + .instagram-proof")).toBeVisible();
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
test("reduced motion, keyboard access and preview pause", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".product-demo video")).toHaveCount(0);
  await expect(page.locator(".demo-cover")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const video = page.locator(".product-demo video");
  await expect(video).toHaveCount(1);
  await video.scrollIntoViewIfNeeded();
  await expect(video.locator('source[type="video/mp4"]')).toHaveAttribute(
    "src",
    "/product-video/1027-loop.mp4",
  );
  expect(
    await video.evaluate(
      (v: HTMLVideoElement) => v.loop && v.muted && v.playsInline,
    ),
  ).toBe(true);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(720);
  expect(await video.evaluate((v: HTMLVideoElement) => v.videoHeight)).toBe(1280);
  expect(await video.evaluate((v: HTMLVideoElement) => v.duration)).toBeCloseTo(20, 0);
  await video.evaluate(async (v: HTMLVideoElement) => {
    v.currentTime = v.duration - 0.2;
    await v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeLessThan(2);
  await page.getByRole("button", { name: "Pausar prévia" }).click();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
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
      await route.fulfill({ json: { status, paymentId: "123" } });
    });
    await page.goto("/");
    await page.locator(".initial-offer .button").click();
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
