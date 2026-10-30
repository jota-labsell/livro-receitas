import { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { body, env, json, failure, sameOrigin } from "@/lib/http";
import { limitedProductAction } from "@/lib/product-access";
import { catalogRestrictions, createCatalogProduct, listCatalog, updateCatalogProduct } from "@/lib/product-catalog";

export async function GET(req:NextRequest) {
 try {
  const runtime=env();
  await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  return json({products:await listCatalog(runtime),limits:catalogRestrictions()});
 } catch(error){return failure(error);}
}
export async function POST(req:NextRequest) {
 try {
  sameOrigin(req);
  const runtime=env(), actor=await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);
  await limitedProductAction(runtime,"product-catalog:"+actor,20);
  const input=await body(req);
  const id= input.action==="create" ? await createCatalogProduct(runtime,actor,input) :
    input.action==="update" ? await updateCatalogProduct(runtime,actor,input) : null;
  if(!id)return json({error:"Ação inválida."},400);
  return json({id,products:await listCatalog(runtime)});
 } catch(error){return failure(error);}
}
