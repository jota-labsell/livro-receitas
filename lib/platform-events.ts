import {CommerceError,hash,validVisit} from './commerce';
import {platformDB,type PlatformEnv} from './platform-core';
import {type PlatformProduct} from './platform-products';
import {limitedProductAction} from './product-access';
export const clean=(value:unknown,max=160)=>typeof value==='string'?value.replace(/[\x00-\x1f]/g,'').trim().slice(0,max):'';
export async function captureSession(env:PlatformEnv,p:PlatformProduct,input:Record<string,unknown>,request:Request){
 if(!validVisit(input.sessionId))throw new CommerceError(400,'Sessão inválida.');
 const consent=input.consent===true&&request.headers.get('sec-gpc')!=='1';
 if(!consent){await platformDB(env).prepare('UPDATE platform_sessions SET consent=0,fbclid=NULL,fbc=NULL,fbp=NULL,client_ip=NULL,user_agent=NULL WHERE id=? AND product_id=?').bind(hash(String(input.sessionId)),p.id).run();return null;}
 const id=hash(String(input.sessionId)),now=Date.now(),a=(input.attribution&&typeof input.attribution==='object'?input.attribution:{}) as Record<string,unknown>;
 let firstSeen=now; if(p.id==='150-doces-comer-vender'){const legacy=await platformDB(env).prepare('SELECT source,medium,campaign,content,term,first_seen FROM operation_sessions WHERE visit_hash=?').bind(id).first<{source:string;medium:string;campaign:string;content:string;term:string;first_seen:number}>();if(legacy){firstSeen=legacy.first_seen;Object.assign(a,{source:legacy.source,utm_source:legacy.source,utm_medium:legacy.medium,utm_campaign:legacy.campaign,utm_content:legacy.content,utm_term:legacy.term});}}
 let sourceURL=env.SITE_URL||'';try{const url=new URL(String(a.source_url));if([new URL(env.SITE_URL!).origin,p.sales_url?new URL(p.sales_url).origin:''].includes(url.origin))sourceURL=url.origin+url.pathname;}catch{}
 const fbclid=clean(a.fbclid,500),fbc=clean(a.fbc,600),fbp=clean(a.fbp,100);
 await platformDB(env).prepare(`INSERT INTO platform_sessions(id,product_id,first_seen,last_seen,source,utm_source,utm_medium,utm_campaign,utm_content,utm_term,campaign_id,adset_id,ad_id,fbclid,fbc,fbp,user_agent,client_ip,pixel_id,source_url,consent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id,product_id) DO UPDATE SET last_seen=excluded.last_seen`).bind(id,p.id,firstSeen,now,clean(a.source)||'direto',clean(a.utm_source),clean(a.utm_medium),clean(a.utm_campaign),clean(a.utm_content),clean(a.utm_term),clean(a.campaign_id),clean(a.adset_id),clean(a.ad_id),/^[A-Za-z0-9_-]{8,500}$/.test(fbclid)?fbclid:null,/^fb\.\d{1,3}\.\d{10,13}\.[A-Za-z0-9_-]{1,500}$/.test(fbc)?fbc:null,/^fb\.1\.\d{10,13}\.\d{1,30}$/.test(fbp)?fbp:null,clean(request.headers.get('user-agent'),512),clean(request.headers.get('cf-connecting-ip'),45),p.pixel_id,sourceURL).run();return id;
}
export async function internalEvent(env:PlatformEnv,eventId:string,name:string,productId:string,session:string|null,order:string|null=null,detail:string|null=null){return platformDB(env).prepare('INSERT OR IGNORE INTO platform_events(event_id,product_id,session_id,order_id,name,created_at,detail) VALUES(?,?,?,?,?,?,?)').bind(eventId,productId,session,order,name,Date.now(),detail).run();}
export async function publicEvent(env:PlatformEnv,p:PlatformProduct,input:Record<string,unknown>,request:Request){
 await limitedProductAction(env,'platform-events:'+hash(request.headers.get('cf-connecting-ip')||'unknown'),90);
 if(!['visit','ViewContent','InitiateCheckout','site_click'].includes(String(input.name))||!validVisit(input.eventId))throw new CommerceError(400,'Evento inválido.');
 const session=await captureSession(env,p,input,request);if(!session)return {received:false};
 const id=input.name==='visit'?hash(`${p.id}:visit:${input.eventId}`):hash(`${p.id}:${session}:${input.name}`);
 await internalEvent(env,id,String(input.name),p.id,session);
 // Queue is distinct from internal events. Meta failures never undo an internal observation.
 if(p.pixel_id&&p.capi_enabled&&input.name!=='site_click')await platformDB(env).prepare('INSERT OR IGNORE INTO platform_meta_events(event_id,name,product_id,session_id,pixel_id,token,available_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,input.name==='visit'?'PageView':input.name,p.id,session,p.pixel_id,p.capi_token,Date.now(),Date.now()).run();
 return {received:true,eventId:id,pixelId:p.pixel_id};
}
