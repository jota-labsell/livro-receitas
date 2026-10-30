import {CommerceError,type CommerceEnv} from './commerce';
import {LEGACY_PRODUCT,platformDB} from './platform-core';
import {productBy,assertSale} from './platform-products';
import {captureSession,internalEvent} from './platform-events';
import {hash,validVisit} from './commerce';
/** Existing signed sessions, payments and PDFs stay on the legacy ledger.
 * New legacy-landing payments are allowed only while its displayed R$10 offer matches DB.
 * Other prices use the dynamic product checkout, never a browser-supplied amount.
 */
export async function requireLegacyOffer(env:CommerceEnv){if(env.JOTAFY_PLATFORM_ENABLED!=='true')return;const p=await productBy(env,LEGACY_PRODUCT);assertSale(p);if(p.amount_cents!==1000||p.currency!=='BRL')throw new CommerceError(409,'Esta oferta mudou. Use a página de checkout atual do produto.');}
export async function linkLegacyOrder(env:CommerceEnv,id:string){if(env.JOTAFY_PLATFORM_ENABLED!=='true')return;await platformDB(env).prepare('INSERT OR IGNORE INTO platform_legacy_products(order_id,product_id) SELECT id,product_id FROM orders WHERE id=?').bind(id).run();}
export async function captureLegacyEvent(env:CommerceEnv,request:Request,input:Record<string,unknown>,name:'visit'|'ViewContent'|'InitiateCheckout'|'site_click'){
 if(env.JOTAFY_PLATFORM_ENABLED!=='true'||!validVisit(input.visitId)||!input.platform||typeof input.platform!=='object')return;
 const context=input.platform as Record<string,unknown>;
 try{const p=await productBy(env,LEGACY_PRODUCT),session=await captureSession(env,p,{...context,sessionId:input.visitId},request);if(!session)return;
 const metaId=name==='visit'?String(input.pageViewEventId||'').slice(0,150):`${name==='ViewContent'?'offer_view':'checkout_start'}:${input.visitId}`;
 const internalId=name==='visit'||name==='site_click'?hash(`legacy:${name}:${String(input.eventId)}`):hash(`legacy:${name}:${session}`);
 await internalEvent(env,internalId,name,p.id,session);
 if(name!=='site_click'&&p.capi_enabled&&p.pixel_id&&metaId)await platformDB(env).prepare('INSERT OR IGNORE INTO platform_meta_events(event_id,name,product_id,session_id,pixel_id,token,available_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(metaId,name==='visit'?'PageView':name,p.id,session,p.pixel_id,p.capi_token,Date.now(),Date.now()).run();
 }catch{console.warn(JSON.stringify({event:'platform_legacy_tracking_unavailable'}));}
}
