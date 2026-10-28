import {hash,preferences,configured,encryptToken,dispatch} from './push.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function authenticated(req,env) {
 if(!env.JOTAFY_TOKEN || !/^[a-f0-9]{64}$/i.test(env.JOTAFY_TOKEN)) return false;
 const a=await hash(req.headers.get('Authorization')||''),b=await hash('Bearer '+env.JOTAFY_TOKEN);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export default {
 async fetch(req,env) {
  const download=new URL(req.url);
  if(req.method==='GET' && download.pathname==='/downloads/JotaFy-2.0-preview.apk') {
   if(!env.RELEASES)return reply({error:'Download indisponível'},503);
   download.pathname='/JotaFy-2.0-preview.apk';
   const asset=await env.RELEASES.fetch(new Request(download.toString()));
   if(asset.status!==200)return new Response('Arquivo não encontrado',{status:404});
   const headers=new Headers(asset.headers);headers.set('Content-Type','application/vnd.android.package-archive');headers.set('Content-Disposition','attachment; filename="JotaFy-2.0-preview.apk"');headers.set('X-Content-Type-Options','nosniff');
   return new Response(asset.body,{status:200,headers});
  }
  if(!env.JOTAFY_TOKEN) return reply({error:'Monitor não configurado'},503);
  if(!await authenticated(req,env)) return reply({error:'Acesso não autorizado'},401);
  const url=new URL(req.url);
  try {
   if(url.pathname==='/devices' && req.method==='POST') {
    if(!configured(env)) return reply({error:'Push aguardando configuração Firebase',code:'firebase_not_configured'},503);
    if(Number(req.headers.get('Content-Length'))>8192) return reply({error:'Dados inválidos'},413);
    const raw=await req.text();if(raw.length>8192)return reply({error:'Dados inválidos'},413);
    let data,prefs;try{data=JSON.parse(raw);prefs=preferences(data.preferences);}catch{return reply({error:'Preferências inválidas'},400);}
    if(!/^[a-f0-9-]{36}$/i.test(data.installationId||'') || typeof data.fcmToken!=='string' || data.fcmToken.length<20 || data.fcmToken.length>4096 || /\s/.test(data.fcmToken))return reply({error:'Dispositivo inválido'},400);
    const now=Date.now(),auth=await hash(env.JOTAFY_TOKEN),tokenHash=await hash(data.fcmToken);
    const old=await env.DB.prepare('SELECT id FROM jotafy_devices WHERE token_hash=? AND id<>?').bind(tokenHash,data.installationId).first();
    if(old)return reply({error:'Token já associado a outro dispositivo'},409);
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM jotafy_devices WHERE active=1 AND auth_hash=? AND id<>?').bind(auth,data.installationId).first();
    if(count.n>=20)return reply({error:'Limite de dispositivos atingido'},429);
    const max=await env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM jotafy_events').first();
    await env.DB.prepare("INSERT INTO jotafy_devices(id,auth_hash,token_hash,token_cipher,preferences,registered_after,enqueued_through,registered_at,updated_at,active) VALUES(?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET auth_hash=excluded.auth_hash,token_hash=excluded.token_hash,token_cipher=excluded.token_cipher,preferences=excluded.preferences,updated_at=excluded.updated_at,registered_after=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.registered_after ELSE jotafy_devices.registered_after END,enqueued_through=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.enqueued_through ELSE jotafy_devices.enqueued_through END,registered_at=CASE WHEN jotafy_devices.active=0 OR jotafy_devices.auth_hash<>excluded.auth_hash THEN excluded.registered_at ELSE jotafy_devices.registered_at END,active=1")
      .bind(data.installationId,auth,tokenHash,await encryptToken(env,data.fcmToken),JSON.stringify(prefs),max.seq,max.seq,now,now).run();
    return reply({registered:true,deviceId:data.installationId,push:'configured'});
   }
   if(url.pathname==='/devices' && req.method==='GET') {
    const rows=await env.DB.prepare('SELECT id,registered_at,updated_at,preferences FROM jotafy_devices WHERE active=1 AND auth_hash=? ORDER BY updated_at DESC').bind(await hash(env.JOTAFY_TOKEN)).all();
    return reply({devices:rows.results.map(r=>({...r,preferences:JSON.parse(r.preferences)}))});
   }
   if(url.pathname.startsWith('/devices/') && req.method==='DELETE') {
    const id=url.pathname.slice(9);
    await env.DB.batch([env.DB.prepare('DELETE FROM jotafy_outbox WHERE device_id IN (SELECT id FROM jotafy_devices WHERE id=? AND auth_hash=?)').bind(id,await hash(env.JOTAFY_TOKEN)),env.DB.prepare('DELETE FROM jotafy_devices WHERE id=? AND auth_hash=?').bind(id,await hash(env.JOTAFY_TOKEN))]);
    return reply({removed:true});
   }
   if(req.method!=='GET')return reply({error:'Método não permitido'},405);
   if(/^\/events\/[1-9][0-9]*$/.test(url.pathname)) {
    const event=await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN orders o ON o.id=e.order_id WHERE e.seq=? AND o.environment='production'").bind(Number(url.pathname.split('/')[2])).first();
    return event?reply({event}):reply({error:'Evento não encontrado'},404);
   }
   if(url.pathname!=='/dashboard')return reply({error:'Não encontrado'},404);
   const days=Number(url.searchParams.get('days')||1);
   if(![1,7,30].includes(days))return reply({error:'Período inválido'},400);
   const now=Date.now(),local=new Date(now-10800000);
   const start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+10800000-(days-1)*86400000;
   const filter=" FROM orders o JOIN funnel_events f ON f.event_key='purchase:'||o.id WHERE o.environment='production' AND o.status='approved' AND f.created_at>=? AND f.created_at<=?";
   const statements=[
    env.DB.prepare("SELECT COUNT(*) AS sales,COALESCE(SUM(o.amount_cents),0) AS revenue"+filter).bind(start,now),
    env.DB.prepare("SELECT COALESCE((SELECT e.method FROM jotafy_events e WHERE e.order_id=o.id AND e.kind='approved' ORDER BY seq DESC LIMIT 1),'unknown') AS method,COUNT(*) AS sales,SUM(o.amount_cents) AS revenue"+filter+" GROUP BY method ORDER BY sales DESC").bind(start,now),
    env.DB.prepare("SELECT strftime('%Y-%m-%d',f.created_at/1000,'unixepoch','-3 hours') AS date,COUNT(*) AS sales,SUM(o.amount_cents) AS revenue"+filter+" GROUP BY date ORDER BY date").bind(start,now),
    env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM jotafy_events')
   ];
   const [summaries,methods,daysRows,maxRows]=await env.DB.batch(statements);
   const raw=url.searchParams.get('after'),after=raw===null?Number(maxRows.results[0].seq):Number(raw);
   if(!Number.isSafeInteger(after)||after<0)return reply({error:'Cursor inválido'},400);
   const events=await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN orders o ON o.id=e.order_id WHERE e.seq>? AND o.environment='production' ORDER BY e.seq LIMIT 100").bind(after).all();
   const recent=await env.DB.prepare("SELECT e.seq,e.kind,e.method,e.amount_cents,e.created_at FROM jotafy_events e JOIN orders o ON o.id=e.order_id WHERE o.environment='production' ORDER BY e.seq DESC LIMIT 25").all();
   const daily=Array.from({length:days},(_,i)=>{
    const date=new Date(start-10800000+i*86400000).toISOString().slice(0,10);
    return daysRows.results.find(row=>row.date===date)||{date,sales:0,revenue:0};
   });
   return reply({days,start,end:now,timezone:'America/Sao_Paulo',summary:summaries.results[0],methods:methods.results,daily,recent:recent.results,events:events.results,cursor:events.results.at(-1)?.seq??after,push:{configured:configured(env)}});
  } catch {return reply({error:'Não foi possível consultar o monitor. Tente novamente.'},503);}
 },
 async scheduled(controller,env,ctx) {ctx.waitUntil(dispatch(env).catch(()=>console.warn('jotafy_dispatch_unavailable')));}
};
