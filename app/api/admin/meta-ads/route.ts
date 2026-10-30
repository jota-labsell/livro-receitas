import { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { body, env, failure, json, sameOrigin } from "@/lib/http";
import { CommerceError } from "@/lib/commerce";
import { limitedProductAction } from "@/lib/product-access";
import { metaAdsConfigured,metaConnectionStatus,listMetaAccounts,chooseMetaAccount,metaInsights,changeMetaStatus,disconnectMeta } from "@/lib/meta-ads";
export async function GET(req:NextRequest) {
 try {
  const runtime=env();
  await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  if(!metaAdsConfigured(runtime))return json({configured:false,connected:false,accounts:[],rows:[]});
  const connection=await metaConnectionStatus(runtime);
  if(!connection.connected)return json({...connection,accounts:[],rows:[]});
  const accounts=await listMetaAccounts(runtime);
  const level=req.nextUrl.searchParams.get("level")||"campaign";
  const today=new Date(Date.now()-10800000).toISOString().slice(0,10);
  const since=req.nextUrl.searchParams.get("since")||today;
  const until=req.nextUrl.searchParams.get("until")||today;
  if(!["campaign","adset","ad"].includes(level))throw new CommerceError(400,"Nível inválido.");
  const insights=connection.accountId?await metaInsights(runtime,level as "campaign"|"adset"|"ad",since,until):null;
  return json({...connection,accounts,...(insights||{rows:[],level,currency:accounts[0]?.currency||"BRL"})});
 }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);
  const runtime=env(),actor=await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  await limitedProductAction(runtime,"meta-ads:"+actor,15);
  const input=await body(req);
  if(input.action==="select_account" && typeof input.accountId==="string")await chooseMetaAccount(runtime,input.accountId);
  else if(input.action==="disconnect")await disconnectMeta(runtime);
  else if(input.action==="change_status" && ["campaign","adset"].includes(String(input.level)) && ["ACTIVE","PAUSED"].includes(String(input.status)) && typeof input.id==="string")
   await changeMetaStatus(runtime,input.level as "campaign"|"adset",input.id,input.status as "ACTIVE"|"PAUSED");
  else throw new CommerceError(400,"Ação Meta inválida.");
  return json({saved:true});
 }catch(e){return failure(e);}
}
