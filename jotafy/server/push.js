const encoder = new TextEncoder();
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unbase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const b64url = bytes => base64(bytes).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function hash(value) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export const defaults = {approved:true,pix_generated:true,rejected:false,refunded:true,charged_back:true,cancelled:false,sound:true,vibration:true,showValue:true};
export function preferences(input = {}) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('preferences');
 const result = {...defaults};
 for(const key of Object.keys(result)) if(key in input) {
  if(typeof input[key] !== 'boolean') throw new Error('preferences');
  result[key] = input[key];
 }
 return result;
}
export function configured(env) {
 return /^[a-f0-9]{64}$/i.test(env.FCM_TOKEN_ENCRYPTION_KEY || '') && !!env.FCM_SERVICE_ACCOUNT && /^[a-z][a-z0-9-]{4,62}$/.test(env.FCM_PROJECT_ID || '');
}
async function encryptionKey(env) {
 const bytes=Uint8Array.from(env.FCM_TOKEN_ENCRYPTION_KEY.match(/../g),v=>parseInt(v,16));
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptToken(env, token) {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),encoder.encode(token));
 return base64(iv)+'.'+base64(cipher);
}
async function decryptToken(env, value) {
 const [iv,cipher]=value.split('.');
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv)},await encryptionKey(env),unbase64(cipher)));
}
let accessCache;
export function resetAccessCache(){accessCache=undefined;}
async function accessToken(env, fetcher, now) {
 const sa=JSON.parse(env.FCM_SERVICE_ACCOUNT);
 if(sa.project_id!==env.FCM_PROJECT_ID || !sa.client_email || !sa.private_key) throw new Error('firebase_configuration');
 if(accessCache && accessCache.email===sa.client_email && accessCache.expires>now+60000) return accessCache.token;
 const header=b64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const seconds=Math.floor(now/1000);
 const claims=b64url(encoder.encode(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600})));
 const pem=sa.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
 const key=await crypto.subtle.importKey('pkcs8',unbase64(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(header+'.'+claims));
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:header+'.'+claims+'.'+b64url(signature)})});
 if(!response.ok) throw new Error('firebase_auth');
 const data=await response.json();
 if(typeof data.access_token!=='string') throw new Error('firebase_auth');
 accessCache={email:sa.client_email,token:data.access_token,expires:now+Math.min(Number(data.expires_in)||3600,3600)*1000};
 return data.access_token;
}
export async function enqueue(env, now=Date.now()) {
 const authHash=await hash(env.JOTAFY_TOKEN);
 const devices=await env.DB.prepare('SELECT * FROM jotafy_devices WHERE active=1 AND auth_hash=? AND updated_at>? ORDER BY updated_at DESC LIMIT 100').bind(authHash,now-90*86400000).all();
 for(const device of devices.results) {
  const rows=await env.DB.prepare("SELECT e.* FROM jotafy_events e JOIN orders o ON o.id=e.order_id WHERE o.environment='production' AND e.seq>? ORDER BY e.seq LIMIT 200").bind(device.enqueued_through).all();
  if(!rows.results.length) continue;
  const prefs=preferences(JSON.parse(device.preferences));
  const stmts=rows.results.map(event=>env.DB.prepare("INSERT OR IGNORE INTO jotafy_outbox(device_id,event_seq,status,available_at,created_at) VALUES(?,?,?,?,?)").bind(device.id,event.seq,prefs[event.kind]===true && event.created_at>=device.registered_at && event.created_at>now-3600000?'pending':'skipped',now,now));
  stmts.push(env.DB.prepare('UPDATE jotafy_devices SET enqueued_through=MAX(enqueued_through,?) WHERE id=?').bind(rows.results.at(-1).seq,device.id));
  await env.DB.batch(stmts);
 }
}
export async function dispatch(env,{fetcher=fetch,now=Date.now()}={}) {
 if(!configured(env)) return {configured:false,sent:0};
 await enqueue(env,now);
 const authHash=await hash(env.JOTAFY_TOKEN);
 await env.DB.prepare("UPDATE jotafy_outbox SET status='expired',claim=NULL WHERE status IN ('pending','sending') AND (attempts>=8 OR created_at<?)").bind(now-3600000).run();
 const pending=await env.DB.prepare("SELECT q.id FROM jotafy_outbox q WHERE q.status IN ('pending','sending') AND q.available_at<=? AND q.lease_until<=? ORDER BY q.id LIMIT 40").bind(now,now).all();
 let sent=0;
 for(const candidate of pending.results) {
  const claim=crypto.randomUUID();
  const leased=await env.DB.prepare("UPDATE jotafy_outbox SET status='sending',claim=?,lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND available_at<=? AND lease_until<=? RETURNING *").bind(claim,now+120000,candidate.id,now,now).first();
  if(!leased) continue;
  const item=await env.DB.prepare("SELECT e.*,d.token_cipher,d.preferences,d.auth_hash,d.active FROM jotafy_events e JOIN jotafy_devices d ON d.id=? JOIN orders o ON o.id=e.order_id WHERE e.seq=? AND o.environment='production'").bind(leased.device_id,leased.event_seq).first();
  let status='pending',error='network',retry=now+Math.min(3600000,15000*2**Math.min(leased.attempts,7));
  if(!item || !item.active || item.auth_hash!==authHash || !preferences(JSON.parse(item.preferences))[item.kind] || item.created_at<now-3600000) {status='skipped';error=null;}
  else {
   try {
    const token=await decryptToken(env,item.token_cipher);
    const bearer=await accessToken(env,fetcher,now);
    const response=await fetcher('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(env.FCM_PROJECT_ID)+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({message:{token,data:{eventId:String(item.seq),kind:item.kind,method:item.method,amountCents:String(item.amount_cents),createdAt:String(item.created_at)},android:{priority:'high',ttl:'3600s',restricted_package_name:'com.jotafy.app'}}})});
    if(response.ok){status='sent';error=null;sent++;}
    else {
     let body={};try{body=await response.json();}catch{}
     const unregistered=body.error?.details?.some(e=>e.errorCode==='UNREGISTERED');
     error=unregistered?'unregistered':'fcm_'+response.status;
     if(unregistered) {await env.DB.prepare('UPDATE jotafy_devices SET active=0 WHERE id=?').bind(leased.device_id).run();status='dead';}
     else if([400,403,404].includes(response.status)) status='dead';
     else if(response.status===401) resetAccessCache();
     const after=Number(response.headers.get('Retry-After'));if(after>0) retry=Math.max(retry,now+Math.min(after,3600)*1000);
    }
   } catch {error='send_unavailable';}
  }
  await env.DB.prepare('UPDATE jotafy_outbox SET status=?,last_error=?,available_at=?,lease_until=0,claim=NULL WHERE id=? AND claim=?').bind(status,error,retry,leased.id,claim).run();
 }
 return {configured:true,sent};
}
