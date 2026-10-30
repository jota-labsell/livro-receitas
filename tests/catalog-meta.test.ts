import {test} from "node:test";
import assert from "node:assert/strict";
import {createCatalogProduct,updateCatalogProduct,listCatalog} from "../lib/product-catalog";
import {beginMetaLogin,normalizeInsights,metaAdsConfigured} from "../lib/meta-ads";

function fakeDb() {
 const rows:Record<string,unknown>[]=[];
 const operations:string[]=[];
 return {
  rows,operations,
  prepare(sql:string){
   const statement:any={
    args:[] as unknown[],
    bind(...args:unknown[]){this.args=args;return this;},
    async first(){return rows.find(p=>p.id===this.args[0])||null},
    async all(){return {results:rows}},
    async run(){
      operations.push(sql);
      if(sql.startsWith("INSERT INTO jotafy_products"))rows.push({
        id:this.args[0],name:this.args[1],description:this.args[2],
        price_cents:this.args[3],currency:"BRL",status:"draft",
        image_url:this.args[4],revision:1,delivery_kind:"digital",created_at:this.args[5],updated_at:this.args[6],
      });
      if(sql.startsWith("UPDATE jotafy_products")){
       const row=rows.find(p=>p.id===this.args[6]);
       if(row&&row.revision===this.args[7]){
         Object.assign(row,{name:this.args[0],description:this.args[1],price_cents:this.args[2],image_url:this.args[3],status:this.args[4],revision:Number(row.revision)+1});
         return {meta:{changes:1}};
       }
       return {meta:{changes:0}};
      }
      return {meta:{changes:1}};
    },
   };return statement;
  },
  async batch(queries:any[]){return Promise.all(queries.map(q=>q.run()))}
 };
}
test("real draft persists, cannot activate, concurrent update rejected",async()=>{
 const db=fakeDb(),env={ORDERS:db} as unknown as CloudflareEnv;
 const id=await createCatalogProduct(env,"actor",{name:"Receitas novas",description:"Rascunho",price_cents:1290,image_url:""});
 assert.ok(/^p-[0-9a-f-]+$/.test(id));
 let row=(await listCatalog(env))[0];assert.equal(row.status,"draft");
 await updateCatalogProduct(env,"actor",{...row,name:"Receitas atualizadas",status:"live"});
 row=(await listCatalog(env))[0];
 assert.equal(row.name,"Receitas atualizadas");assert.equal(row.status,"draft");
 await assert.rejects(updateCatalogProduct(env,"actor",{...row,revision:1,name:"Conflito"}),/outra sessão/);
 assert.ok(db.operations.some(s=>s.includes("operation_audit")));
});
test("existing live product price is protected",async()=>{
 const db=fakeDb();
 db.rows.push({id:"150-doces-comer-vender",name:"150 Doces",description:"",price_cents:1000,revision:1,status:"live",image_url:""});
 const env={ORDERS:db} as unknown as CloudflareEnv;
 await assert.rejects(updateCatalogProduct(env,"actor",{id:"150-doces-comer-vender",revision:1,name:"150 Doces",price_cents:2000}),/protegido/);
});
test("Meta insights normalize link clicks, outbound and landing views without conflating totals",()=>{
 const rows=normalizeInsights([{campaign_id:"1234",campaign_name:"teste",spend:"14.16",clicks:"30",inline_link_clicks:"22",outbound_clicks:[{value:"20"}],actions:[{action_type:"landing_page_view",value:"5"},{action_type:"purchase",value:"2"}]}],"campaign");
 assert.deepEqual({total:rows[0].clicks,link:rows[0].linkClicks,outbound:rows[0].outboundClicks,visits:rows[0].landingPageViews},{total:30,link:22,outbound:20,visits:5});
});
test("Meta setup is disabled without secrets and OAuth uses server-side state",async()=>{
 assert.equal(metaAdsConfigured({}),false);
 const db=fakeDb(),env={ORDERS:db,SITE_URL:"https://example.workers.dev",META_ADS_APP_ID:"1234567890",META_ADS_APP_SECRET:"f".repeat(32),META_ADS_ENCRYPTION_KEY:"f".repeat(64)} as unknown as CloudflareEnv;
 const {url,state}=await beginMetaLogin(env,"actor");
 assert.match(url,/facebook.com\/v26.0\/dialog\/oauth/);
 assert.match(url,/ads_read%2Cads_management/);
 assert.equal(state.length,64);
 assert.ok(!JSON.stringify(db.operations).includes(state));
});
