import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';

await mkdir('work/meta-panel-preview', { recursive: true });
await build({ stdin: { contents: 'import React from "react";import{createRoot}from"react-dom/client";import{MetaDiagnosticsScreen}from"./components/meta-diagnostics-screen";createRoot(document.getElementById("root")).render(<MetaDiagnosticsScreen/>);', resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', jsx: 'automatic', outfile: 'work/meta-panel-preview/panel.js', define: { 'process.env.NODE_ENV': '"production"' } });
const folder = path.resolve('work/meta-panel-preview');
await build({ stdin: { contents: 'import React from "react";import{createRoot}from"react-dom/client";import{AccessAdminLogin}from"./components/access-admin-screen";createRoot(document.getElementById("root")).render(<AccessAdminLogin destination={location.pathname==="/meta-login"?"/admin/meta":"/admin/acesso"}/>);', resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'browser', jsx: 'automatic', outfile: 'work/meta-panel-preview/login.js', define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  const file = ['/panel.js', '/panel.css', '/login.js', '/login.css'].includes(req.url) ? req.url.slice(1) : null;
  const entry = ['/meta-login', '/support-login'].includes(req.url) ? 'login' : 'panel';
  res.setHeader('Content-Type', file?.endsWith('.js') ? 'text/javascript' : file?.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
  res.end(file ? await readFile(path.join(folder, file)) : `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Meta preview fixture</title><link rel="stylesheet" href="/${entry}.css"><body style="margin:0;font-family:Arial,sans-serif"><div id="root"></div><script src="/${entry}.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'chrome' } : {}), headless: true });
try {
  for (const width of [402, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    let sent = 0;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/admin/meta', async route => {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON();
        assert.equal(input.testEventCode, 'TEST123'); assert.equal(input.action, 'test'); sent++;
        return route.fulfill({ json: { accepted: true, eventId: 'diagnostic:fixture', checkedAt: Date.now(), httpStatus: 200, eventsReceived: 1, traceId: 'trace_fixture', errorCode: null, errorSubcode: null, message: 'Evento de teste recebido. Confira a aba de testes da Meta.' } });
      }
      return route.fulfill({ json: { pixelId: '1150409944170993', graphVersion: 'v26.0', tokenConfigured: true, automaticEnabled: false, automaticFlowConnected: false, tablesAvailable: false, purchases: [{ id: 'fixture-approved-order', amount_cents: 1000, approved_at: Date.now(), state: null, attempts: null, sent_at: null }], checkedAt: Date.now() } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.getByText('Integração pendente', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Enviar evento de teste' }).click();
    assert.equal(sent, 0, 'An empty test code must not send anything');
    await page.getByLabel('Código de eventos de teste').fill('TEST123');
    await page.getByRole('button', { name: 'Enviar evento de teste' }).click();
    await page.getByRole('heading', { name: 'Meta confirmou o recebimento' }).waitFor();
    assert.equal(sent, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page must fit viewport');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(folder, `meta-${width}.png`), fullPage: true });
    console.log(`OK ${width}px: configuration, missing-code protection, submission, response and no horizontal overflow`);
    await page.close();
  }
  for (const scenario of [
    { path: '/meta-login', heading: 'Entrar no painel da Meta', destination: '/admin/meta' },
    { path: '/support-login', heading: 'Recuperação de acesso', destination: '/admin/acesso' },
  ]) {
    const page = await browser.newPage();
    let attempts = 0;
    await page.route('**/api/admin/ebook/login', route => {
      attempts++;
      assert.equal(route.request().postDataJSON().key, 'fixture-admin-key');
      return route.fulfill(attempts === 1 ? { status: 401, json: { error: 'Fixture invalid credential' } } : { json: { ok: true } });
    });
    await page.route(`**${scenario.destination}`, route => route.fulfill({ contentType: 'text/html', body: '<h1>Authenticated destination fixture</h1>' }));
    await page.goto(`http://127.0.0.1:${server.address().port}${scenario.path}`);
    await page.getByRole('heading', { name: scenario.heading, exact: true }).waitFor();
    await page.getByLabel('Credencial administrativa').fill('fixture-admin-key');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fixture invalid credential' }).waitFor();
    assert.ok(page.url().endsWith(scenario.path), 'Invalid login must remain on the login screen');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(`**${scenario.destination}`);
    assert.equal(attempts, 2);
    console.log(`OK login: invalid credential stays on screen; successful login opens ${scenario.destination}`);
    await page.close();
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
