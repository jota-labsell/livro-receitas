import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('monitor authenticates, isolates production, counts approvals, and pages events',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:await readFile('jotafy/server/worker.js','utf8'),compatibilityDate:'2026-10-27',d1Databases:['DB'],bindings:{JOTAFY_TOKEN:'a'.repeat(64)}}));
 try{
 const db=await mf.getD1Database('DB');for(const file of ['0001_commerce.sql','0002_order_environment.sql','0003_jotafy.sql'])for(const stmt of (await readFile('migrations/'+file,'utf8')).split(';').filter(s=>s.trim()))await db.prepare(stmt).run();
 assert.equal((await mf.dispatchFetch('http://localhost/dashboard')).status,401);
 const headers={Authorization:'Bearer '+'a'.repeat(64)};
 assert.equal((await mf.dispatchFetch('http://localhost/dashboard?days=999',{headers})).status,400);
 const now=Date.now();for(const [id,environment] of [['real','production'],['test','sandbox']]){
 await db.prepare("INSERT INTO orders(id,access_hash,visit_hash,product_id,amount_cents,currency,status,created_at,updated_at,environment) VALUES(?,?,?,'product',1000,'BRL','approved',?,?,?)").bind(id,id,id,now,now,environment).run();
 await db.prepare("INSERT INTO funnel_events(event_key,name,visit_hash,order_id,amount_cents,currency,created_at) VALUES(?,'purchase_approved',?,?,1000,'BRL',?)").bind('purchase:'+id,id,id,now).run();}
 await db.prepare("INSERT INTO jotafy_events(event_key,order_id,kind,method,amount_cents,created_at) VALUES('real:approved','real','approved','pix',1000,?)").bind(now).run();
 const first=await (await mf.dispatchFetch('http://localhost/dashboard',{headers})).json();assert.deepEqual(first.summary,{sales:1,revenue:1000});assert.equal(first.methods[0].method,'pix');assert.equal(first.events.length,0);assert.equal(first.cursor,1);
 const replay=await (await mf.dispatchFetch('http://localhost/dashboard?after=0',{headers})).json();assert.equal(replay.events.length,1);assert.equal(replay.cursor,1);
 assert.equal((await mf.dispatchFetch('http://localhost/dashboard?after=-1',{headers})).status,400);
 }finally{await mf.dispose();}
});
