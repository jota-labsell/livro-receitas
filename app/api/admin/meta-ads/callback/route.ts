import { NextRequest,NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { env, failure } from "@/lib/http";
import { finishMetaLogin } from "@/lib/meta-ads";
export async function GET(req:NextRequest){
 try{
  const runtime=env(),actor=await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  if(req.nextUrl.searchParams.has("error"))return NextResponse.redirect(new URL("/admin?meta_ads=denied",req.url),303);
  await finishMetaLogin(runtime,actor,req.nextUrl.searchParams.get("state")||undefined,req.cookies.get("__Host-jf-meta-oauth")?.value,req.nextUrl.searchParams.get("code")||undefined);
  const response=NextResponse.redirect(new URL("/admin?meta_ads=connected",req.url),303);
  response.cookies.set("__Host-jf-meta-oauth","",{path:"/",secure:true,httpOnly:true,maxAge:0,sameSite:"lax"});
  response.headers.set("Cache-Control","no-store");
  return response;
 }catch(e){return failure(e);}
}
