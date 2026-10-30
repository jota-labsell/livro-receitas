import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
await mkdir("work/management-preview", { recursive: true });
await build({ stdin: {
  contents: 'import React from "react";import{createRoot}from"react-dom/client";import{ManagementDashboard}from"./components/management-dashboard";createRoot(document.getElementById("root")).render(<ManagementDashboard/>);',
  resolveDir: process.cwd(), loader: "tsx"
}, bundle: true, platform: "browser", jsx: "automatic", outfile: "work/management-preview/panel.js", define: { "process.env.NODE_ENV": '"production"' } });
const fixture = {
  sources: ["meta"],
  summary: { orders: 5, revenue: 2000, approved: 2, pending: 2, reversed: 1, pending_amount: 2000, refunded_amount: 1000, chargeback_amount: 0, rejected: 0 },
  days: [{day: "2026-10-29", orders: 3, revenue: 1000}, {day: "2026-10-30", orders: 2, revenue: 1000}],
  orders: [{id: "fixture-order", status: "approved", amount_cents: 1000, created_at: Date.now()}],
  hasMore: false, page: 1,
  campaigns: [{source: "meta", medium: "paid_social", campaign: "Campanha de teste", sessions: 10, orders: 5, approved: 2, revenue: 2000}],
  funnel: {sessions: 10, views: 9, clicks: 7, checkouts: 6, orders: 5, approved: 2},
  meta: [{state: "sent", total: 2, max_attempts: 1}], push: [], health: [], trackingAvailable: true,
  settings: {pixelId: "1150409944170993", capiPaused: false, available: true},
  product: {id: "150-doces-comer-vender", name: "150 Doces para Comer e Vender", price: 10},
  services: {database: true, ebook: true, paymentsConfigured: true, metaConfigured: true}, checkedAt: Date.now()
};
const server = createServer(async (req,res)=>{
  const file = req.url === "/panel.js" ? "panel.js" : req.url === "/panel.css" ? "panel.css" : null;
  res.setHeader("Content-Type", file?.endsWith(".js") ? "text/javascript" : file ? "text/css" : "text/html");
  res.end(file ? await readFile("work/management-preview/" + file) :
    '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/panel.css"></head><body style="margin:0"><div id="root"></div><script src="/panel.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : process.platform === "win32" ? { channel: "chrome" } : {}),
  args: ["--no-sandbox"]
});
const origin = "http://127.0.0.1:" + server.address().port;
try {
  for (const width of [360, 402, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = []; const posts = [];
    page.on("pageerror", e=>errors.push(e.message));
    await page.route("**/api/admin/operations?*", route=>route.fulfill({ json: fixture }));
    await page.route("**/api/admin/operations", route=>{ posts.push(route.request().postDataJSON()); return route.fulfill({ json: { saved: true } }); });
    await page.goto(origin);
    await page.getByText("R$ 20,00", { exact: true }).first().waitFor();
    await page.getByText("Lucro estimado", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Produtos", exact: true }).click();
    await page.getByRole("heading", { name: "Seus produtos", exact: true }).waitFor();
    await page.getByRole("textbox", { name: "Buscar produtos" }).fill("sem resultado");
    await page.getByRole("heading", { name: "Nenhum produto encontrado" }).waitFor();
    await page.getByRole("button", { name: "Limpar busca" }).click();
    await page.getByRole("button", { name: "Ver tabela" }).click();
    await page.getByRole("button", { name: "Gerenciar" }).click();
    await page.getByRole("button", { name: "Rastreamento" }).click();
    await page.getByLabel("ID do Pixel").fill("1150409944170993");
    await page.getByLabel("Pausar envio automático da CAPI").check();
    await page.getByText("Alterações não salvas", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.getByText("Configuração salva com sucesso e registrada na auditoria.").waitFor();
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0], { pixelId: "1150409944170993", capiPaused: true });
    await page.getByRole("button", { name: "Produtos", exact: true }).click();
    await page.getByRole("button", { name: "Operação e campanhas" }).click();
    await page.getByRole("heading", { name: /Funil de conversão/ }).waitFor();
    await page.getByPlaceholder("Filtrar campanhas na tabela").fill("campanha de teste");
    await page.getByText("Campanha de teste").first().waitFor();
    await page.screenshot({ path: `work/management-preview/redesign-${width}.png`, fullPage: true });
    const hasOverflow = await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth);
    assert.equal(hasOverflow, false, `Horizontal overflow at ${width}px`);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`OK ${width}px: product workspace, tracking save, campaign filter and responsive layout`);
  }
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
