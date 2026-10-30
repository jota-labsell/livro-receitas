import { createHash,createHmac,randomBytes,randomUUID,timingSafeEqual } from "node:crypto";
import { CommerceError } from "./commerce";

export type MetaEnv=CloudflareEnv;
const version="v26.0";
const base="https://graph.facebook.com/"+version;
const oauthBase="https://www.facebook.com/"+version;
function credentials(env:MetaEnv){
 if(!env.META_ADS_APP_ID || !/^\d{5,30}$/.test(env.META_ADS_APP_ID) ||
    !env.META_ADS_APP_SECRET || !/^[a-fA-F0-9]{32,}$/.test(env.META_ADS_APP_SECRET) ||
    !env.META_ADS_ENCRYPTION_KEY || !/^[a-fA-F0-9]{64}$/.test(env.META_ADS_ENCRYPTION_KEY) ||
    !env.SITE_URL?.startsWith("https://") || !env.ORDERS)
  throw new CommerceError(503,"Configure META_ADS_APP_ID, META_ADS_APP_SECRET e META_ADS_ENCRYPTION_KEY no Worker e aplique a migration 0011.");
 return {appId:env.META_ADS_APP_ID,appSecret:env.META_ADS_APP_SECRET,key:env.META_ADS_ENCRYPTION_KEY,site:env.SITE_URL,db:env.ORDERS};
}
export function metaAdsConfigured(env:MetaEnv) {
 try{credentials(env);return true;}catch{return false;}
}
function redirectUri(env:MetaEnv) {return credentials(env).site+"/api/admin/meta-ads/callback";}
const hex=(v:Uint8Array)=>Buffer.from(v).toString("hex");
const digest=(v:string)=>createHash("sha256").update(v).digest("hex");
const constantEquals=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function aes(env:MetaEnv, use:"encrypt"|"decrypt", data:string, iv:Uint8Array){
 const key=await crypto.subtle.importKey("raw",Buffer.from(credentials(env).key,"hex"),"AES-GCM",false,[use]);
 const result=use==="encrypt" ?
  await crypto.subtle.encrypt({name:"AES-GCM",iv:new Uint8Array(iv)},key,new TextEncoder().encode(data)) :
  await crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(iv)},key,Buffer.from(data,"base64"));
 return use==="encrypt"?Buffer.from(result).toString("base64"):new TextDecoder().decode(result);
}
type Connection={token_enc:string;iv:string;expires_at:number;user_id:string;ad_account_id:string;updated_at:number};
async function readConnection(env:MetaEnv) {
 const c=credentials(env);
 return c.db.prepare("SELECT * FROM meta_ads_connection WHERE id=1").first<Connection>();
}
export async function metaConnectionStatus(env:MetaEnv){
 const c=await readConnection(env);
 return {connected:!!c&&c.expires_at>Date.now(),accountId:c?.ad_account_id||"",expiresAt:c?.expires_at||0,configured:true};
}
export async function beginMetaLogin(env:MetaEnv,actor:string){
 const c=credentials(env),state=hex(randomBytes(32));
 await c.db.batch([
  c.db.prepare("DELETE FROM meta_ads_oauth_states WHERE expires_at<?").bind(Date.now()),
  c.db.prepare("INSERT INTO meta_ads_oauth_states(state_hash,actor,expires_at) VALUES(?,?,?)").bind(digest(state),actor,Date.now()+600000),
 ]);
 const url=new URL(oauthBase+"/dialog/oauth");
 url.searchParams.set("client_id",c.appId);
 url.searchParams.set("redirect_uri",redirectUri(env));
 url.searchParams.set("state",state);
 url.searchParams.set("scope","ads_read,ads_management");
 url.searchParams.set("response_type","code");
 return {url:url.toString(),state};
}
async function graph<T>(path:string,params:Record<string,string>,token:string,env:MetaEnv,method:"GET"|"POST"="GET",fetcher:typeof fetch=fetch):Promise<T>{
 const url=new URL(base+"/"+path.replace(/^\//,""));
 if(!/^[a-zA-Z0-9_/-]+$/.test(path)) throw new CommerceError(400,"Recurso Meta inválido.");
 const secret=credentials(env).appSecret;
 const proof=createHmac("sha256",secret).update(token).digest("hex");
 url.searchParams.set("appsecret_proof",proof);
 const form=new URLSearchParams(params);
 if(method==="GET")for(const [k,v]of Object.entries(params)) url.searchParams.set(k,v);
 let response:Response;
 try{ response=await fetcher(url.toString(),{method,headers:{
  Authorization:"Bearer "+token,...(method==="POST"?{"Content-Type":"application/x-www-form-urlencoded"}:{})},
  ...(method==="POST"?{body:form.toString()}:{}),cache:"no-store",signal:AbortSignal.timeout(15000)});
 }catch{throw new CommerceError(502,"Não foi possível consultar a Meta. Tente novamente.");}
 if(!response.ok){if(response.status===401||response.status===400)throw new CommerceError(401,"Meta recusou a autorização. Reconecte a conta ou revise as permissões do aplicativo.");
  throw new CommerceError(502,"A Meta não respondeu à consulta. Verifique acesso e limites da API.");}
 return response.json() as Promise<T>;
}
export async function finishMetaLogin(env:MetaEnv,actor:string,state:string|undefined,stored:string|undefined,code:string|undefined,fetcher:typeof fetch=fetch){
 const c=credentials(env);
 if(!state||!stored||!constantEquals(state,stored)||!code||code.length>800)
  throw new CommerceError(401,"Autorização Meta inválida ou expirada.");
 const record=await c.db.prepare("SELECT state_hash,actor,expires_at FROM meta_ads_oauth_states WHERE state_hash=?")
  .bind(digest(state)).first<{state_hash:string;actor:string;expires_at:number}>();
 if(!record||record.actor!==actor||record.expires_at<Date.now())throw new CommerceError(401,"Autorização Meta expirada.");
 await c.db.prepare("DELETE FROM meta_ads_oauth_states WHERE state_hash=?").bind(record.state_hash).run();
 const url=new URL(base+"/oauth/access_token");
 url.searchParams.set("client_id",c.appId);url.searchParams.set("client_secret",c.appSecret);
 url.searchParams.set("redirect_uri",redirectUri(env));url.searchParams.set("code",code);
 const r=await fetcher(url.toString(),{signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!r.ok)throw new CommerceError(401,"Login não autorizado pela Meta. Verifique o aplicativo.");
 const short=await r.json() as {access_token?:string;expires_in?:number};
 if(!short.access_token)throw new CommerceError(401,"A Meta não retornou autorização.");
 const longUrl=new URL(base+"/oauth/access_token");longUrl.searchParams.set("grant_type","fb_exchange_token");
 longUrl.searchParams.set("client_id",c.appId);longUrl.searchParams.set("client_secret",c.appSecret);longUrl.searchParams.set("fb_exchange_token",short.access_token);
 const lr=await fetcher(longUrl.toString(),{signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!lr.ok)throw new CommerceError(401,"Não foi possível concluir a autorização Meta.");
 const long=await lr.json() as {access_token?:string;expires_in?:number};
 const token=long.access_token||short.access_token;
 const user=await graph<{id:string}>("me",{fields:"id"},token,env,"GET",fetcher);
 if(!/^\d+$/.test(user.id))throw new CommerceError(401,"Conta Meta inválida.");
 const iv=randomBytes(12),encrypted=await aes(env,"encrypt",token,iv);
 const expiry=Date.now()+Math.min(60*86400,Math.max(3600,long.expires_in||short.expires_in||3600))*1000;
 await c.db.prepare("INSERT INTO meta_ads_connection(id,token_enc,iv,expires_at,user_id,ad_account_id,updated_at) VALUES(1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token_enc=excluded.token_enc,iv=excluded.iv,expires_at=excluded.expires_at,user_id=excluded.user_id,ad_account_id='',updated_at=excluded.updated_at")
  .bind(encrypted,hex(iv),expiry,user.id,"",Date.now()).run();
 return true;
}
async function tokenFor(env:MetaEnv){
 const row=await readConnection(env);
 if(!row||row.expires_at<Date.now())throw new CommerceError(401,"Conecte novamente sua conta Meta Ads.");
 return {token:await aes(env,"decrypt",row.token_enc,Buffer.from(row.iv,"hex")),accountId:row.ad_account_id};
}
type Account={id:string;name:string;currency:string;account_status:number;timezone_name?:string};
export async function listMetaAccounts(env:MetaEnv,fetcher:typeof fetch=fetch){
 const {token}=await tokenFor(env);
 const result=await graph<{data:Account[]}>("me/adaccounts",{fields:"id,name,currency,account_status,timezone_name",limit:"100"},token,env,"GET",fetcher);
 return result.data.map(a=>({id:a.id,name:a.name,currency:a.currency,status:a.account_status,timezone:a.timezone_name||""})).filter(x=>/^act_\d+$/.test(x.id));
}
export async function chooseMetaAccount(env:MetaEnv,id:string,fetcher:typeof fetch=fetch) {
 if(!/^act_\d+$/.test(id))throw new CommerceError(400,"Conta de anúncios inválida.");
 const accounts=await listMetaAccounts(env,fetcher);
 if(!accounts.some(a=>a.id===id))throw new CommerceError(403,"Conta de anúncios não autorizada.");
 await credentials(env).db.prepare("UPDATE meta_ads_connection SET ad_account_id=?,updated_at=? WHERE id=1").bind(id,Date.now()).run();
 return true;
}
type Insight={campaign_id?:string;campaign_name?:string;adset_id?:string;adset_name?:string;ad_id?:string;ad_name?:string;spend?:string;impressions?:string;reach?:string;clicks?:string;inline_link_clicks?:string;outbound_clicks?:{value:string}[];actions?:{action_type:string;value:string}[];date_start?:string;date_stop?:string};
const num=(x:unknown)=>typeof x==="string"||typeof x==="number"?Number(x)||0:0;
export function normalizeInsights(rows:Insight[],level:"campaign"|"adset"|"ad"){
 return rows.map(x=>({
  id:level==="campaign"?x.campaign_id:level==="adset"?x.adset_id:x.ad_id,
  name:level==="campaign"?x.campaign_name:level==="adset"?x.adset_name:x.ad_name,
  campaignId:x.campaign_id||"",campaignName:x.campaign_name||"",
  adsetId:x.adset_id||"",adsetName:x.adset_name||"",
  spend:num(x.spend),impressions:num(x.impressions),reach:num(x.reach),
  clicks:num(x.clicks),linkClicks:(x.actions||[]).some(a=>a.action_type==="link_click") ? (x.actions||[]).filter(a=>a.action_type==="link_click").reduce((s,a)=>s+num(a.value),0) : num(x.inline_link_clicks),
  outboundClicks:(x.outbound_clicks||[]).reduce((s,a)=>s+num(a.value),0),
  landingPageViews:(x.actions||[]).filter(a=>a.action_type==="landing_page_view").reduce((s,a)=>s+num(a.value),0),
 }));
}
export async function metaInsights(env:MetaEnv,level:"campaign"|"adset"|"ad",since:string,until:string,fetcher:typeof fetch=fetch) {
 const {token,accountId}=await tokenFor(env);
 if(!/^act_\d+$/.test(accountId))throw new CommerceError(400,"Selecione uma conta de anúncios.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(since)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||since>until||Date.parse(until)-Date.parse(since)>93*86400000)
  throw new CommerceError(400,"Escolha um intervalo de até 93 dias.");
 const fields="campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,inline_link_clicks,outbound_clicks,actions";
 const rows=await graph<{data:Insight[]}>(accountId+"/insights",{level,fields,time_range:JSON.stringify({since,until}),limit:"100"},token,env,"GET",fetcher);
 const currency=(await graph<{currency:string}>(accountId,{fields:"currency"},token,env,"GET",fetcher)).currency;
 return {level,accountId,currency,rows:normalizeInsights(rows.data,level),since,until,limitedToFirstPage:rows.data.length>=100};
}
export async function changeMetaStatus(env:MetaEnv,level:"campaign"|"adset",id:string,status:"ACTIVE"|"PAUSED",fetcher:typeof fetch=fetch){
 if(!/^\d{3,30}$/.test(id)||!["ACTIVE","PAUSED"].includes(status))throw new CommerceError(400,"Ação inválida.");
 const {token,accountId}=await tokenFor(env);
 if(!/^act_\d+$/.test(accountId))throw new CommerceError(400,"Selecione uma conta Meta.");
 const item=await graph<{id:string;account_id:string}>(id,{fields:"id,account_id"},token,env,"GET",fetcher);
 if(item.id!==id||item.account_id!==accountId.slice(4)) throw new CommerceError(403,"Campanha ou conjunto não pertence à conta selecionada.");
 await graph<{success:boolean}>(id,{status},token,env,"POST",fetcher);
 return true;
}
export async function disconnectMeta(env:MetaEnv){
 await credentials(env).db.prepare("DELETE FROM meta_ads_connection WHERE id=1").run();
}
