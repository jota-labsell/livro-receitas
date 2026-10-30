import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { env, failure } from "@/lib/http";
import { beginMetaLogin } from "@/lib/meta-ads";
export async function GET(req:NextRequest){
 try{
  const runtime=env(),actor=await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  const {state,url}=await beginMetaLogin(runtime,actor);
  const response=NextResponse.redirect(url,302);
  response.cookies.set("__Host-jf-meta-oauth",state,{path:"/",secure:true,httpOnly:true,sameSite:"lax",maxAge:600});
  response.headers.set("Cache-Control","no-store");
  return response;
 }catch(e){return failure(e);}
}
