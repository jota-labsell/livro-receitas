// Requires Wrangler dev with LOCAL test D1, fixture key a*64 and HTTPS port 8787.
// The origin is intentionally fixed: this test must never mutate production.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {request,chromium} from '@playwright/test';
const origin='https://127.0.0.1:8787';
const options={baseURL:origin,ignoreHTTPSErrors:true,extraHTTPHeaders:{Origin:origin}};
const contexts=[];
async function client(storageState){const c=await request.newContext({...options,...(storageState?{storageState}:{})});contexts.push(c);return c;}
const key='a'.repeat(64),first='local-fixture-password-first',second='local-fixture-password-second';
const anonymous=await client();let browser;
try{
 for(const endpoint of ['/api/admin/operations','/api/admin/ebook','/api/admin/meta'])assert.equal((await anonymous.get(endpoint)).status(),401,endpoint);
 assert.equal((await anonymous.post('/api/admin/account',{data:{email:'fixture@example.com',password:first}})).status(),401);
 assert.equal((await anonymous.post('/api/admin/session',{headers:{Origin:'https://foreign.example'},data:{email:'fixture@example.com',password:first}})).status(),403);
 const setup=await client();
 assert.equal((await setup.post('/api/admin/ebook/login',{data:{key}})).status(),200);
 const oldSetupState=await setup.storageState();
 assert.equal((await setup.post('/api/admin/account',{data:{email:'fixture@example.com',password:first,currentPassword:second}})).status(),200);
 assert.equal((await (await client(oldSetupState)).get('/api/admin/operations')).status(),401);
 const login=await client();
 assert.equal((await login.post('/api/admin/session',{data:{email:'fixture@example.com',password:first,remember:true}})).status(),200);
 const state=await login.storageState(),cookie=state.cookies.find(c=>c.name==='__Host-recipe-support');
 assert.ok(cookie?.secure&&cookie.httpOnly&&cookie.sameSite==='Strict');
 assert.ok(cookie.expires-Date.now()/1000>6.9*86400);
 const dashboard=await login.get('/api/admin/operations');assert.equal(dashboard.status(),200);
 const data=await dashboard.json();assert.equal(data.summary.orders,0);assert.equal(data.services.database,true);assert.equal(data.product.price,10);
 await mkdir('work/management-worker-preview',{recursive:true});
 browser=await chromium.launch({...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox']});
 for(const width of [360,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,storageState:state,viewport:{width,height:1000}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/admin');await page.getByText('Receita aprovada',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Vendas e pedidos',exact:true}).click();await page.getByRole('heading',{name:'Histórico de pedidos'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Exportar página'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`work/management-worker-preview/empty-orders-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);await context.close();
 }
 assert.equal((await login.post('/api/admin/account',{data:{email:'fixture@example.com',password:second,currentPassword:'incorrect'}})).status(),401);
 assert.equal((await login.post('/api/admin/account',{data:{email:'fixture@example.com',password:second,currentPassword:first}})).status(),200);
 assert.equal((await (await client(state)).get('/api/admin/operations')).status(),401);
 const finalLogin=await client();assert.equal((await finalLogin.post('/api/admin/session',{data:{email:'fixture@example.com',password:second}})).status(),200);
 const beforeLogout=await finalLogin.storageState();assert.equal((await finalLogin.delete('/api/admin/session')).status(),200);
 assert.equal((await (await client(beforeLogout)).get('/api/admin/operations')).status(),401);
 console.log('PASS: artefato Worker local; APIs protegidas, origem, cadastro restrito, cookie sete dias, painel 360/1440px, senha atual, revogação global e logout. Nenhum dado de produção utilizado.');
}finally{await browser?.close();await Promise.all(contexts.map(c=>c.dispose()));}
