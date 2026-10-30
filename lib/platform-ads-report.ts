import {platformDB,type PlatformEnv} from './platform-core';
export async function adsReport(env:PlatformEnv,filters:Record<string,string>){
 const db=platformDB(env),{start,end,product='',campaign='',adset='',ad=''}=filters;
 const integrations=(await db.prepare("SELECT id,last_sync,currency,timezone,attribution FROM platform_meta_integrations WHERE last_sync IS NOT NULL AND currency='BRL'").all<{id:string;attribution:string;currency:string;timezone:string;last_sync:number}>()).results;
 const coverage=await db.prepare('SELECT COUNT(*) n FROM platform_ads_coverage c JOIN platform_meta_integrations i ON i.id=c.integration_id AND i.attribution=c.attribution AND i.currency=\'BRL\' AND i.last_sync IS NOT NULL WHERE c.day>=? AND c.day<=?').bind(start,end).first<{n:number}>();
 const days=(Date.parse(end)-Date.parse(start))/86400000+1,covered=integrations.length>0&&coverage?.n===days*integrations.length;
 const mapped=product?await db.prepare('SELECT COUNT(*) n FROM platform_ads_entities WHERE product_id=?').bind(product).first<{n:number}>():null;
 // More specific association wins: ad, then adset, then campaign. No double allocation.
 const effectiveProduct=`COALESCE((SELECT e.product_id FROM platform_ads_entities e WHERE e.integration_id=d.integration_id AND e.kind='ad' AND e.id=d.ad_id),(SELECT e.product_id FROM platform_ads_entities e WHERE e.integration_id=d.integration_id AND e.kind='adset' AND e.id=d.adset_id),(SELECT e.product_id FROM platform_ads_entities e WHERE e.integration_id=d.integration_id AND e.kind='campaign' AND e.id=d.campaign_id))`;
 const base=`FROM platform_ads_daily d JOIN platform_meta_integrations i ON i.id=d.integration_id AND i.attribution=d.attribution AND i.currency='BRL' WHERE d.day>=? AND d.day<=? AND d.level=? AND (?='' OR ${effectiveProduct}=?) AND (?='' OR d.campaign_id=?) AND (?='' OR d.adset_id=?) AND (?='' OR d.ad_id=?)`;
 const args=[start,end,product||campaign||adset||ad?'ad':'account',product,product,campaign,campaign,adset,adset,ad,ad];
 const rows=(await db.prepare('SELECT d.integration_id,d.day,d.level,d.entity_id,d.campaign_id,d.adset_id,d.ad_id,d.spend_cents,d.impressions,d.reach,d.frequency,d.link_clicks,d.ctr,d.cpc,d.cpm,d.attribution,d.synced_at '+base+' ORDER BY d.day DESC,d.entity_id LIMIT 501').bind(...args).all<Record<string,unknown>>()).results;
 const totals=await db.prepare('SELECT COALESCE(SUM(d.spend_cents),0) spend,COALESCE(SUM(d.link_clicks),0) clicks,COALESCE(SUM(d.link_clicks IS NULL),0) missing_clicks '+base).bind(...args).first<{spend:number;clicks:number;missing_clicks:number}>();
 const unrepresentable=['status','method','source','utm_source','pixel','q'].some(k=>Boolean(filters[k]));
 const available=covered&&!unrepresentable&&(!product||Boolean(mapped?.n));
 return {integrations,rows:rows.slice(0,500),hasMore:rows.length>500,available,spend:available?totals?.spend??null:null,clicks:available&&totals?.missing_clicks===0?totals.clicks:null,coverage:{covered,start,end},associationPriority:'ad > adset > campaign'};
}
