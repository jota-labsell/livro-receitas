'use client';
export function platformContext(sessionId:string,product='150-doces-comer-vender'){
 let consent=true;try{consent=localStorage.getItem('recipe-ad-measurement')!=='deny';}catch{}
 if((navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)consent=false;
 const q=new URLSearchParams(location.search),cookie=(name:string)=>{try{return decodeURIComponent(document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'');}catch{return '';}};
 let first:Record<string,unknown>={source:q.get('utm_source')||(q.has('fbclid')?'meta':document.referrer?'referencia':'direto'),...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','adset_id','ad_id','fbclid'].map(k=>[k,q.get(k)]))};
 try{const key='jotafy-first:'+product,stored=sessionStorage.getItem(key);if(stored)first=JSON.parse(stored);else{const old=product==='150-doces-comer-vender'?JSON.parse(sessionStorage.getItem('recipe-operation-origin')||'null'):null;if(old)first={...first,source:old.source,utm_source:old.source,utm_medium:old.medium,utm_campaign:old.campaign,utm_content:old.content,utm_term:old.term};sessionStorage.setItem(key,JSON.stringify(first));}}catch{}
 const click=typeof first.fbclid==='string'&&/^[A-Za-z0-9_-]{8,500}$/.test(first.fbclid)?first.fbclid:null;
 let fbc=cookie('_fbc');try{const key='jotafy-fbc:'+product,stored=sessionStorage.getItem(key);if(stored)fbc=stored;else if(click){fbc=`fb.1.${Date.now()}.${click}`;sessionStorage.setItem(key,fbc);}}catch{}
 return {sessionId,consent,attribution:{...first,source_url:location.origin+location.pathname,fbc,fbp:cookie('_fbp')}};
}
