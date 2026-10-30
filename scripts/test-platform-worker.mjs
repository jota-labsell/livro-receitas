// Real OpenNext artifact with an isolated, local D1. Never uses production credentials.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import {request,chromium} from '@playwright/test';
const origin='https://127.0.0.1:8791',config='work/platform-smoke.json',state='work/platform-smoke-state-'+Date.now();
await mkdir('work',{recursive:true});
const base=JSON.parse(await readFile('wrangler.jsonc','utf8'));
delete base.$schema;delete base.services;delete base.triggers;
base.name='jotafy-local-platform-test';base.main=path.resolve('worker.ts');base.assets.directory=path.resolve('.open-next/assets');
base.vars={SITE_URL:origin,EBOOK_ADMIN_KEY:'a'.repeat(64),PLATFORM_ENCRYPTION_KEY:'b'.repeat(64),JOTAFY_PLATFORM_ENABLED:'true',META_CAPI_ENABLED:'false',CHECKOUT_ENABLED:'true',LIVE_PAYMENTS_ENABLED:'true',MERCADOPAGO_MODE:'production',MERCADOPAGO_ACCESS_TOKEN:'local-fixture-only',MERCADOPAGO_PUBLIC_KEY:'local-fixture-only',MERCADOPAGO_COLLECTOR_ID:'123',MERCADOPAGO_WEBHOOK_SECRET:'local-fixture-only'};
await writeFile(config,JSON.stringify(base));
const names=['0001_commerce','0002_order_environment','0003_jotafy','0007_meta_capi','0008_product_access','0009_meta_automatic','0010_operations','0011_jotafy_platform'];
let sql='';for(const name of names)sql+=await readFile('migrations/'+name+'.sql','utf8')+'\n';
sql+=await readFile('tests/fixtures/jotafy-live-schema.sql','utf8');
await writeFile('work/platform-smoke.sql',sql);
const cli='node_modules/wrangler/bin/wrangler.js';
execFileSync(process.execPath,[cli,'d1','execute','receitas-premium-150-orders','--local','--config',config,'--persist-to',state,'--file','work/platform-smoke.sql'],{stdio:'pipe',windowsHide:true});
const child=spawn(process.execPath,[cli,'dev','--config',config,'--port','8791','--local-protocol','https','--persist-to',state],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
let browser;const clients=[];
async function client(storageState){const c=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:origin},...(storageState?{storageState}:{})});clients.push(c);return c;}
try{
 const anon=await client();let ready=false;for(let i=0;i<80;i++){try{await anon.get('/admin/entrar',{timeout:1000});ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}assert.ok(ready,output.slice(-1800));
 for(const url of ['/api/admin/platform','/api/admin/operations'])assert.equal((await anon.get(url)).status(),401,url);
 assert.equal((await anon.post('/api/admin/account',{data:{email:'local@example.com',password:'local-fixture-password'}})).status(),401);
 assert.equal((await anon.post('/api/admin/platform',{headers:{Origin:'https://foreign.example'},data:{action:'save_product'}})).status(),403);
 const admin=await client();assert.equal((await admin.post('/api/admin/ebook/login',{data:{key:'a'.repeat(64)}})).status(),200);
 assert.equal((await admin.post('/api/admin/account',{data:{email:'local@example.com',password:'local-fixture-password'}})).status(),200);
 assert.equal((await admin.post('/api/admin/session',{data:{email:'local@example.com',password:'local-fixture-password',remember:true}})).status(),200);
 const create=await admin.post('/api/admin/platform',{data:{action:'save_product',name:'Local product',slug:'local-fixture',amount_cents:2900,currency:'BRL',status:'draft',delivery_type:'manual',instructions:'Local delivery only',sales_url:'https://sales.example/product'}});assert.equal(create.status(),200,await create.text());let product=await create.json();
 assert.equal((await anon.get('/checkout/local-fixture')).status(),404);
 assert.equal((await anon.get('/api/store/local-fixture')).status(),401);
 const active=await admin.post('/api/admin/platform',{data:{...product,action:'save_product',status:'active'}});assert.equal(active.status(),200,await active.text());product=await active.json();
 const checkout=await anon.post('/api/store/local-fixture',{data:{action:'checkout',embedded:true,sessionId:crypto.randomUUID(),consent:false,amount_cents:1,currency:'USD'}});assert.equal(checkout.status(),200,await checkout.text());
 const cookie=checkout.headers()['set-cookie'];assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=None/i);assert.match(cookie,/Partitioned/i);
 const current=await anon.post('/api/store/local-fixture',{data:{action:'status'}});assert.equal(current.status(),200);assert.equal((await current.json()).status,'created');
 const html=await anon.get('/checkout/local-fixture');assert.equal(html.status(),200);assert.match(html.headers()['content-security-policy'],/frame-ancestors 'self' https:\/\/sales.example/);
 assert.equal((await anon.get('/api/track/local-fixture')).status(),200);assert.equal((await anon.get('/api/embed/local-fixture')).status(),200);
 assert.equal((await anon.post('/api/track/local-fixture',{headers:{Origin:'https://evil.example'},data:{name:'visit',sessionId:crypto.randomUUID(),eventId:crypto.randomUUID(),consent:true}})).status(),403);
 browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
 for(const width of [360,1440]){const context=await browser.newContext({ignoreHTTPSErrors:true,storageState:await admin.storageState(),viewport:{width,height:1000}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/admin');await page.getByRole('heading',{name:'Funil de vendas',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.goto(origin+'/admin/produtos');await page.getByRole('link',{name:'Novo produto',exact:true}).waitFor();assert.deepEqual(errors,[]);await page.screenshot({path:`work/platform-ui/artifact-products-${width}.png`,fullPage:true});await context.close();}
 const copied=await admin.storageState();assert.equal((await admin.delete('/api/admin/session')).status(),200);assert.equal((await (await client(copied)).get('/api/admin/platform')).status(),401);
 console.log('PASS: real Worker artifact, local D1, restricted signup/login/logout, protected APIs, dynamic product lifecycle, embedded secure partitioned cookie, CSP, CORS, dashboard/products 360/1440px. No provider POST or production data.');
}finally{await browser?.close();await Promise.all(clients.map(c=>c.dispose()));child.kill();}
