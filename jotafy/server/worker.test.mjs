import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {dispatch,enqueue,resetAccessCache} from './push.js';

const script=(await build({entryPoints:['jotafy/server/worker.js'],bundle:true,write:false,format:'esm',platform:'browser'})).outputFiles[0].text;
const auth={Authorization:'Bearer '+'a'.repeat(64)};
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const project='jotafy-unit-test';
const privateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const pushConfig={JOTAFY_TOKEN:'a'.repeat(64),FCM_PROJECT_ID:project,FCM_TOKEN_ENCRYPTION_KEY:'b'.repeat(64),FCM_SERVICE_ACCOUNT:JSON.stringify({project_id:project,client_email:'fixture@jotafy-unit-test.iam.gserviceaccount.com',private_key:privateKey})};
async function setup(configured=true) {
 const bindings=configured?pushConfig:{JOTAFY_TOKEN:'a'.repeat(64)};
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-27',d1Databases:['DB'],bindings}));
 const db=await mf.getD1Database('DB');
 for(const file of ['0001_commerce.sql','0002_order_environment.sql','0003_jotafy.sql','0004_jotafy_push.sql'])
  for(const stmt of (await readFile('migrations/'+file,'utf8')).split(';').filter(s=>s.trim()))await db.prepare(stmt).run();
 const request=(path,method='GET',body,headers=auth)=>mf.dispatchFetch('http://localhost'+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const register=(installationId=id,preferences={},token='fixture-registration-token-1')=>request('/devices','POST',{installationId,preferences,fcmToken:token});
 const order=async(name,environment='production',status='approved',at=Date.now())=>{
  await db.prepare("INSERT INTO orders(id,access_hash,visit_hash,product_id,amount_cents,currency,status,created_at,updated_at,environment) VALUES(?,?,?,'product',1000,'BRL',?,?,?,?)").bind(name,name,name,status,at,at,environment).run();
  await db.prepare("INSERT INTO funnel_events(event_key,name,visit_hash,order_id,amount_cents,currency,created_at) VALUES(?,'purchase_approved',?,?,1000,'BRL',?)").bind('purchase:'+name,name,name,at).run();
 };
 const event=async(name,kind='approved',method='pix',at=Date.now())=>{
  await db.prepare('INSERT INTO jotafy_events(event_key,order_id,kind,method,amount_cents,created_at) VALUES(?,?,?,?,1000,?)').bind(name+':'+kind,name,kind,method,at).run();
 };
 return {mf,db,request,register,order,event,env:{...pushConfig,DB:db}};
}
test('all monitor endpoints require authentication and configuration fails closed',async()=>{
 const s=await setup(false);try{
  for(const [path,method,body] of [['/dashboard','GET'],['/devices','GET'],['/devices','POST',{installationId:id}],['/devices/'+id,'DELETE'],['/events/1','GET']])assert.equal((await s.request(path,method,body,{})).status,401);
  assert.equal((await s.register()).status,503);
  assert.equal((await s.request('/dashboard?days=999')).status,400);
  assert.equal((await s.request('/dashboard?after=-1')).status,400);
  assert.equal((await s.request('/push','POST',{})).status,405);
 }finally{await s.mf.dispose();}
});
test('calendar charts and methods use only approved production sales, with real zero days',async()=>{
 const s=await setup();try{
  const now=Date.now(),local=new Date(now-10800000),start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+10800000;
  await s.order('today','production','approved',now);await s.event('today');
  await s.order('yesterday','production','approved',start-1);
  await s.order('sandbox','sandbox','approved',now);await s.event('sandbox');
  await s.order('refund','production','refunded',now);
  const first=await (await s.request('/dashboard')).json();
  assert.deepEqual(first.summary,{sales:1,revenue:1000});assert.equal(first.daily.length,1);assert.equal(first.daily[0].revenue,1000);assert.equal(first.events.length,0);
  assert.equal(first.methods[0].method,'pix');assert.equal(first.methods[0].revenue,1000);assert.equal(first.recent.length,1);assert.ok(first.recent[0].seq);
  const seven=await (await s.request('/dashboard?days=7&after=0')).json();
  assert.deepEqual(seven.summary,{sales:2,revenue:2000});assert.equal(seven.daily.length,7);assert.equal(seven.daily.reduce((n,d)=>n+d.sales,0),2);assert.equal(seven.daily.filter(d=>d.sales===0).length,5);assert.equal(seven.events.length,1);
  assert.equal((await s.request('/events/'+first.recent[0].seq)).status,200);
  assert.equal((await s.request('/events/'+(first.recent[0].seq+1))).status,404);
 }finally{await s.mf.dispose();}
});
test('device registration encrypts token, renews without rewinding cursor and deletes pending sends',async()=>{
 const s=await setup();try{
  await s.order('old');await s.event('old');
  assert.equal((await s.register()).status,200);
  const original=await s.db.prepare('SELECT * FROM jotafy_devices WHERE id=?').bind(id).first();
  assert.equal(original.registered_after,1);assert.ok(!original.token_cipher.includes('fixture-registration-token'));
  assert.equal((await s.register(id,{showValue:false},'fixture-registration-token-2')).status,200);
  const renewed=await s.db.prepare('SELECT * FROM jotafy_devices WHERE id=?').bind(id).first();
  assert.notEqual(renewed.token_hash,original.token_hash);assert.equal(renewed.registered_after,1);assert.equal(renewed.registered_at,original.registered_at);
  assert.equal(JSON.parse(renewed.preferences).showValue,false);
  const listed=await (await s.request('/devices')).json();assert.equal(listed.devices.length,1);assert.ok(!JSON.stringify(listed).includes('token'));
  assert.equal((await s.register(id,{sound:'yes'})).status,400);
  assert.equal((await s.request('/devices','POST',{installationId:'bad',fcmToken:'short'})).status,400);
  assert.equal((await s.register(id2,{},'fixture-registration-token-2')).status,409);
  assert.equal((await s.request('/devices/'+id,'DELETE')).status,200);
  assert.equal((await s.db.prepare('SELECT COUNT(*) AS n FROM jotafy_devices').first()).n,0);
 }finally{await s.mf.dispose();}
});
test('outbox excludes old/sandbox events, honors categories, and deduplicates by event and device',async()=>{
 const s=await setup();try{
  const now=Date.now()+1000;
  await s.order('old');await s.event('old');
  await s.register(id,{pix_generated:false});await s.register(id2,{},'fixture-second-device-token');
  await s.order('new');await s.event('new','approved','pix',now);await s.event('new','pix_generated','pix',now);
  await s.order('test','sandbox');await s.event('test','approved','pix',now);
  await enqueue(s.env,now);await enqueue(s.env,now);
  const rows=await s.db.prepare('SELECT * FROM jotafy_outbox ORDER BY id').all();
  assert.equal(rows.results.length,4);assert.equal(rows.results.filter(r=>r.status==='pending').length,3);assert.ok(rows.results.every(r=>r.event_seq!==1));
  let calls=0;resetAccessCache();
  const fake=async(url,options)=>{if(url.includes('oauth2'))return Response.json({access_token:'fixture-oauth',expires_in:3600});calls++;const message=JSON.parse(options.body).message;assert.ok(message.data.eventId);assert.equal(message.android.restricted_package_name,'com.jotafy.app');assert.equal(message.notification,undefined);return Response.json({name:'fixture-message'});};
  await Promise.all([dispatch(s.env,{now,fetcher:fake}),dispatch(s.env,{now,fetcher:fake})]);
  assert.equal(calls,3);await dispatch(s.env,{now:now+200000,fetcher:fake});assert.equal(calls,3);
 }finally{await s.mf.dispose();}
});
test('transient FCM failure retries; unregistered tokens deactivate without touching commerce',async()=>{
 const s=await setup();try{
  await s.register();const now=Date.now()+1000;await s.order('new');await s.event('new','approved','pix',now);
  resetAccessCache();let attempts=0;
  const fake=async(url)=>{if(url.includes('oauth2'))return Response.json({access_token:'fixture-oauth',expires_in:3600});attempts++;return attempts===1?Response.json({error:{status:'UNAVAILABLE'}},{status:503}):Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404});};
  await dispatch(s.env,{now,fetcher:fake});let row=await s.db.prepare('SELECT * FROM jotafy_outbox').first();assert.equal(row.status,'pending');assert.equal(row.attempts,1);
  await dispatch(s.env,{now:now+100,fetcher:fake});assert.equal(attempts,1);
  await dispatch(s.env,{now:now+60000,fetcher:fake});row=await s.db.prepare('SELECT * FROM jotafy_outbox').first();assert.equal(row.status,'dead');assert.equal((await s.db.prepare('SELECT active FROM jotafy_devices').first()).active,0);
  assert.equal((await s.db.prepare("SELECT status FROM orders WHERE id='new'").first()).status,'approved');
 }finally{await s.mf.dispose();}
});
test('rotation of monitor auth and expired events never deliver stale notifications',async()=>{
 const s=await setup();try{
  await s.register();const now=Date.now()+1000;await s.order('new');await s.event('new','approved','pix',now);
  let calls=0;await dispatch({...s.env,JOTAFY_TOKEN:'c'.repeat(64)},{now,fetcher:async()=>{calls++;throw Error('not expected');}});assert.equal(calls,0);
  await enqueue(s.env,now);await dispatch(s.env,{now:now+3600001,fetcher:async()=>{calls++;throw Error('not expected');}});assert.equal(calls,0);
  assert.equal((await s.db.prepare('SELECT status FROM jotafy_outbox').first()).status,'expired');
 }finally{await s.mf.dispose();}
});
