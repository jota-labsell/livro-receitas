// Read-only monitor. Store a random 32-byte hex JOTAFY_TOKEN via wrangler secret put.
const reply = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function digest(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))); }
export default {
 async fetch(req,env) {
  if(req.method !== 'GET') return reply({error:'Método não permitido'},405);
  if(!env.JOTAFY_TOKEN || env.JOTAFY_TOKEN.length<64) return reply({error:'Monitor não configurado'},503);
  const actual=await digest(req.headers.get('Authorization')||'');
  const expected=await digest('Bearer '+env.JOTAFY_TOKEN); let diff=0;
  for(let i=0;i<actual.length;i++) diff |= actual[i]^expected[i];
  if(diff) return reply({error:'Acesso não autorizado'},401);
  const u=new URL(req.url);
  if(u.pathname!=='/dashboard') return reply({error:'Não encontrado'},404);
  const days=Number(u.searchParams.get('days')||1);
  if(![1,7,30].includes(days)) return reply({error:'Período inválido'},400);
  const now=Date.now();
  // São Paulo has UTC-03, no daylight savings. Calendar days, not sliding 24h.
  const local=new Date(now-3*3600000);
  const start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+3*3600000-(days-1)*86400000;
  try {
   const summary=await env.DB.prepare(`SELECT COUNT(*) AS sales,COALESCE(SUM(o.amount_cents),0) AS revenue FROM orders o JOIN funnel_events f ON f.event_key='purchase:'||o.id WHERE o.environment='production' AND o.status='approved' AND f.created_at>=? AND f.created_at<=?`).bind(start,now).first();
   const methods=await env.DB.prepare(`SELECT COALESCE((SELECT e.method FROM jotafy_events e WHERE e.order_id=o.id AND e.kind='approved' ORDER BY seq DESC LIMIT 1),'unknown') AS method,COUNT(*) AS sales FROM orders o JOIN funnel_events f ON f.event_key='purchase:'||o.id WHERE o.environment='production' AND o.status='approved' AND f.created_at>=? AND f.created_at<=? GROUP BY method ORDER BY sales DESC`).bind(start,now).all();
   // Cursor is global and monotonic; oldest unseen first so a burst never skips notifications.
   const raw=u.searchParams.get('after');
   const max=await env.DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM jotafy_events').first();
   const after=raw===null?Number(max.seq):Number(raw);
   if(!Number.isSafeInteger(after)||after<0) return reply({error:'Cursor inválido'},400);
   const events=await env.DB.prepare('SELECT seq,kind,method,amount_cents,created_at FROM jotafy_events WHERE seq>? ORDER BY seq LIMIT 100').bind(after).all();
   const recent=await env.DB.prepare('SELECT kind,method,amount_cents,created_at FROM jotafy_events ORDER BY seq DESC LIMIT 25').all();
   return reply({days,start,end:now,summary,methods:methods.results,recent:recent.results,events:events.results,cursor:events.results.at(-1)?.seq??after});
  } catch { return reply({error:'Não foi possível consultar o monitor. Confira as migrations.'},503); }
 }
};
