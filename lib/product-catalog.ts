import { randomUUID } from "node:crypto";
import { CommerceError } from "./commerce";
import { PRODUCT_CONFIG } from "./product.config";

export type CatalogProduct = {
 id:string; name:string; description:string; price_cents:number; currency:"BRL";
 status:"live"|"draft"|"archived"; delivery_kind:"digital"; image_url:string;
 created_at:number; updated_at:number; revision:number;
};
const primary = PRODUCT_CONFIG.id;
const validId = (id:unknown):id is string => typeof id==="string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
const clean = (v:unknown,n:number) => typeof v==="string" ? v.trim().slice(0,n) : "";
function db(env:CloudflareEnv) {if(!env.ORDERS)throw new CommerceError(503,"Banco de produtos indisponível.");return env.ORDERS;}
function check(input:Record<string,unknown>,existing?:CatalogProduct) {
 const name=clean(input.name,120), description=clean(input.description,1500);
 const price=input.price_cents;
 if(!name || name.length<3 || typeof price!=="number" || !Number.isSafeInteger(price) || price<100 || price>100000000)
   throw new CommerceError(400,"Informe nome válido e preço entre R$ 1 e R$ 1.000.000.");
 const image=clean(input.image_url,240);
 if(image && !/^\/(?!\/)[a-z0-9/_.-]+$/i.test(image)) throw new CommerceError(400,"Imagem deve ser um caminho interno válido.");
 const status=existing ? (existing.id===primary ? "live" : (input.status==="archived"?"archived":"draft")) : "draft";
 // The hardcoded production checkout is intentionally not updated from this catalog.
 if(existing?.id===primary && price!==PRODUCT_CONFIG.amountCents)
   throw new CommerceError(409,"Preço do produto em produção é protegido pelo checkout e não pode ser alterado aqui.");
 return {name,description,price,image,status};
}
export async function listCatalog(env:CloudflareEnv) {
 return (await db(env).prepare("SELECT * FROM jotafy_products ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,updated_at DESC LIMIT 150").all<CatalogProduct>()).results;
}
export async function createCatalogProduct(env:CloudflareEnv,actor:string,input:Record<string,unknown>) {
 const x=check(input), now=Date.now();
 const id="p-"+randomUUID();
 await db(env).batch([
  db(env).prepare("INSERT INTO jotafy_products(id,name,description,price_cents,currency,status,delivery_kind,image_url,created_at,updated_at,revision) VALUES(?,?,?,?,'BRL','draft','digital',?,?,?,1)")
   .bind(id,x.name,x.description,x.price,x.image,now,now),
  db(env).prepare("INSERT INTO operation_audit(id,actor,action,created_at) VALUES(?,?,?,?)")
   .bind(randomUUID(),actor,"catalog_create",now),
 ]);
 return id;
}
export async function updateCatalogProduct(env:CloudflareEnv,actor:string,input:Record<string,unknown>) {
 if(!validId(input.id) && !(typeof input.id==="string" && /^p-[a-f0-9-]{36}$/.test(input.id))) throw new CommerceError(400,"Produto inválido.");
 const old=await db(env).prepare("SELECT * FROM jotafy_products WHERE id=?").bind(input.id).first<CatalogProduct>();
 if(!old)throw new CommerceError(404,"Produto não encontrado.");
 if(typeof input.revision!=="number" || input.revision!==old.revision)throw new CommerceError(409,"Produto modificado em outra sessão. Atualize o catálogo.");
 const x=check(input,old), now=Date.now();
 const updated=await db(env).prepare("UPDATE jotafy_products SET name=?,description=?,price_cents=?,image_url=?,status=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?")
 .bind(x.name,x.description,x.price,x.image,x.status,now,old.id,old.revision).run();
 if(updated.meta.changes!==1)throw new CommerceError(409,"Produto alterado por outra sessão.");
 await db(env).prepare("INSERT INTO operation_audit(id,actor,action,created_at) VALUES(?,?,?,?)")
  .bind(randomUUID(),actor,"catalog_update",now).run();
 return old.id;
}
export function catalogRestrictions() {
 return {checkoutProductId:primary, livePriceCents:PRODUCT_CONFIG.amountCents, newProductCheckoutEnabled:false};
}
