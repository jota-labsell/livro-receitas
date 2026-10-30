import {platformDB,unseal,health,LEGACY_PRODUCT,type PlatformEnv} from './platform-core';
import {productBy} from './platform-products';
type MetaRow={event_id:string;name:string;product_id:string;order_id:string|null;session_id:string|null;pixel_id:string;token:string|null;attempts:number;created_at:number};
export async function dispatchPlatformMeta(env:PlatformEnv,fetcher:typeof fetch=fetch){
 const db=platformDB(env),now=Date.now();const queue=await db.prepare("SELECT * FROM platform_meta_events WHERE state IN ('pending','sending') AND available_at<=? AND lease_until<? AND attempts<12 ORDER BY created_at LIMIT 15").bind(now,now).all<MetaRow>();let sent=0;
 for(const row of queue.results){
  const product=await productBy(env,row.product_id);if(!product.capi_enabled||(product.id===LEGACY_PRODUCT&&env.META_CAPI_ENABLED!=='true'))continue;
  const encrypted=row.token||product.capi_token;const token=encrypted?unseal(env,encrypted,'product:'+product.id+':capi'):(product.id===LEGACY_PRODUCT?env.META_CAPI_ACCESS_TOKEN:undefined);if(!token)continue;
  const order=row.order_id?await db.prepare('SELECT status,amount_cents,currency,product_name FROM platform_orders WHERE id=?').bind(row.order_id).first<{status:string;amount_cents:number;currency:string;product_name:string}>():null;
  if((row.name==='Purchase'&&order?.status!=='approved')||now-row.created_at>6*86400000){await db.prepare("UPDATE platform_meta_events SET state='dead' WHERE event_id=?").bind(row.event_id).run();continue;}
  const session=await db.prepare('SELECT * FROM platform_sessions WHERE id=? AND product_id=? AND consent=1').bind(row.session_id,product.id).first<{fbc:string|null;fbp:string|null;client_ip:string|null;user_agent:string|null;source_url?:string|null}>();if(!session){await db.prepare("UPDATE platform_meta_events SET state='dead' WHERE event_id=?").bind(row.event_id).run();continue;}
  const claim=await db.prepare("UPDATE platform_meta_events SET state='sending',attempts=attempts+1,lease_until=? WHERE event_id=? AND state IN ('pending','sending') AND lease_until<? AND attempts<12").bind(now+120000,row.event_id,now).run();if(!claim.meta.changes)continue;
  let status:number|null=null,code:number|null=null,accepted=false,permanent=false;
  try{
   const response=await fetcher(`https://graph.facebook.com/${env.META_GRAPH_VERSION||'v26.0'}/${row.pixel_id}/events`,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token.trim(),'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),body:JSON.stringify({data:[{event_name:row.name,event_id:row.event_id,event_time:Math.floor(row.created_at/1000),action_source:'website',event_source_url:session.source_url||new URL('/checkout/'+product.slug,env.SITE_URL).href,user_data:{...(session.fbc?{fbc:session.fbc}:{}),...(session.fbp?{fbp:session.fbp}:{}),...(session.client_ip?{client_ip_address:session.client_ip}:{}),...(session.user_agent?{client_user_agent:session.user_agent}:{})},custom_data:{content_ids:[product.id],content_type:'product',currency:order?.currency||product.currency,value:(order?.amount_cents||product.amount_cents)/100}}]})});
   status=response.status;const data=await response.json() as {events_received?:number;error?:{code?:number}};code=Number.isSafeInteger(data.error?.code)?data.error!.code!:null;accepted=response.ok&&data.events_received===1&&!data.error;permanent=!accepted&&response.status>=400&&response.status<500&&response.status!==429&&![1,2,4,17,32,613].includes(code||0);
  }catch{}
  await db.prepare('UPDATE platform_meta_events SET state=?,http_status=?,error_code=?,sent_at=?,available_at=?,lease_until=0 WHERE event_id=?').bind(accepted?'sent':permanent||row.attempts+1>=12?'dead':'pending',status,code,accepted?Date.now():null,Date.now()+Math.min(3600000,60000*2**row.attempts),row.event_id).run();
  await health(env,'capi',accepted?undefined:'meta_send_unconfirmed');if(accepted)sent++;
 }
 return sent;
}
