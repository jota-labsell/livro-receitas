"use client";
import {useCallback,useEffect,useState} from "react";
import {BarChart3,ExternalLink,Link2,RefreshCw,ShieldCheck,Unplug,AlertCircle} from "lucide-react";
import styles from "./meta-ads-workspace.module.css";
type Account={id:string;name:string;currency:string;status:number;timezone:string};
type Row={id:string;name:string;campaignName:string;adsetName:string;spend:number;impressions:number;reach:number;clicks:number;linkClicks:number;outboundClicks:number;landingPageViews:number};
type ResponseData={configured:boolean;connected:boolean;accountId:string;expiresAt:number;accounts:Account[];level:string;currency:string;rows:Row[];limitedToFirstPage?:boolean;error?:string};
type Level="campaign"|"adset"|"ad";
const localToday=()=>new Date(Date.now()-10800000).toISOString().slice(0,10);
const localWeek=()=>new Date(Date.now()-10800000-6*86400000).toISOString().slice(0,10);
const integer=(n:number)=>n.toLocaleString("pt-BR");
const money=(n:number,c:string)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:/^[A-Z]{3}$/.test(c)?c:"BRL"}).format(n);
export function MetaAdsWorkspace(){
 const [data,setData]=useState<ResponseData|null>(null);
 const [loading,setLoading]=useState(true),[actionBusy,setActionBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [level,setLevel]=useState<Level>("campaign");
 const [since,setSince]=useState(localWeek()),[until,setUntil]=useState(localToday());
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const query=new URLSearchParams({level,since,until});
   const r=await fetch("/api/admin/meta-ads?"+query,{cache:"no-store"});
   const j=await r.json() as ResponseData;
   if(r.status===401){throw Error(j.error||"A autorização da Meta expirou; reconecte a conta.")}
   if(!r.ok)throw Error(j.error||"Falha ao consultar a Meta.");
   setData(j);
  }catch(e){setError((e as Error).message)}
  finally{setLoading(false)}
 },[level,since,until]);
 useEffect(()=>{void load()},[load]);
 const post=async(body:Record<string,unknown>)=>{
  setActionBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/admin/meta-ads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const j=await r.json() as {error?:string};
   if(!r.ok)throw Error(j.error||"A Meta não confirmou a alteração.");
   setNotice("Operação confirmada pela Meta.");
   await load();
  }catch(e){setError((e as Error).message)}
  finally{setActionBusy(false)}
 };
 const changeStatus=async(row:Row,status:"ACTIVE"|"PAUSED")=>{
  const verb=status==="PAUSED"?"pausar":"ativar";
  if(!row.id||!confirm(`Confirma ${verb} "${row.name}" na Meta Ads? Esta alteração afeta a veiculação real e o gasto.`))return;
  await post({action:"change_status",level,id:row.id,status});
 };
 const sum=(k:keyof Row)=>data?.rows.reduce((t,r)=>t+(Number(r[k])||0),0)||0;
 const connected=Boolean(data?.connected);
 return <div className={styles.wrap}>
  <div className={styles.heading}><div><p className={styles.eyebrow}>METATRACK / MARKETING API</p><h2>Gerenciador de anúncios</h2><p>Campanhas, conjuntos e anúncios com dados obtidos diretamente da conta autorizada.</p></div>
   <button className={styles.secondary} disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/> Atualizar</button>
  </div>
  {!!error&&<p className={styles.error} role="alert"><AlertCircle size={15}/>{error}</p>}
  {!!notice&&<p className={styles.notice} role="status">{notice}</p>}
  {loading&&!data&&<p className={styles.loading}>Consultando conexão Meta Ads…</p>}
  {data&&!data.configured&&<section className={styles.empty}><ShieldCheck size={24}/><h3>Integração não configurada no servidor</h3>
   <p>Cadastre as credenciais do aplicativo Meta e a chave criptográfica nos segredos do Worker. Nenhuma chave deve ser colocada no navegador.</p></section>}
  {data?.configured&&!connected&&<section className={styles.empty}><Link2 size={26}/><h3>Conecte sua conta de anúncios</h3>
   <p>O login oficial da Meta solicitará acesso para consultar relatórios e alterar o estado das campanhas ou conjuntos após confirmação.</p>
   <a className={styles.primary} href="/api/admin/meta-ads/connect"><ExternalLink size={16}/> Conectar com Facebook</a>
   <small>Permissões solicitadas: ads_read e ads_management. A Meta pode exigir avaliação do aplicativo para contas externas.</small>
  </section>}
  {connected&&data&&<>
   <section className={styles.filters}>
    <label>Conta de anúncios<select value={data.accountId||""} disabled={actionBusy} onChange={e=>void post({action:"select_account",accountId:e.target.value})}>
     <option value="">Selecione uma conta</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.id} ({a.currency})</option>)}
    </select></label>
    <label>Visualizar<select value={level} onChange={e=>setLevel(e.target.value as Level)}><option value="campaign">Campanhas</option><option value="adset">Conjuntos</option><option value="ad">Anúncios</option></select></label>
    <label>Início<input type="date" value={since} onChange={e=>setSince(e.target.value)}/></label>
    <label>Fim<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
   </section>
   {data.accountId&&<>
    <div className={styles.metrics}>
      <div><span>Investimento Meta</span><strong>{money(sum("spend"),data.currency)}</strong></div>
      <div><span>Cliques no link</span><strong>{integer(sum("linkClicks"))}</strong></div>
      <div><span>Visualizações da página</span><strong>{integer(sum("landingPageViews"))}</strong></div>
      <div><span>Cliques de saída</span><strong>{integer(sum("outboundClicks"))}</strong></div>
    </div>
    <section className={styles.panel}><div className={styles.panelHead}><h3>{level==="campaign"?"Campanhas":level==="adset"?"Conjuntos de anúncios":"Anúncios"}</h3>
      <span>Moeda: {data.currency} · Período selecionado</span></div>
      <div className={styles.scroller}><table><thead><tr><th>Nome</th><th>Gasto</th><th>Impressões</th><th>Alcance</th><th>Cliques totais</th><th>Cliques link</th><th>Saídas</th><th>Visitas destino</th><th>Visitas/link</th><th>Custo/visita</th><th>Ações</th></tr></thead>
       <tbody>{data.rows.map(row=><tr key={row.id}><td><strong>{row.name||row.id}</strong><small>{level!=="campaign"?row.campaignName:""}</small></td>
        <td>{money(row.spend,data.currency)}</td><td>{integer(row.impressions)}</td><td>{integer(row.reach)}</td><td>{integer(row.clicks)}</td>
        <td>{integer(row.linkClicks)}</td><td>{integer(row.outboundClicks)}</td>
        <td>{integer(row.landingPageViews)}</td><td>{row.linkClicks?((100*row.landingPageViews/row.linkClicks).toFixed(1)+"%"):"—"}</td><td>{row.landingPageViews?money(row.spend/row.landingPageViews,data.currency):"—"}</td>
        <td>{level!=="ad"?<div className={styles.actions}><button disabled={actionBusy} onClick={()=>void changeStatus(row,"PAUSED")}>Pausar</button><button disabled={actionBusy} onClick={()=>void changeStatus(row,"ACTIVE")}>Ativar</button></div>:<span>—</span>}</td></tr>)}</tbody></table></div>
       {!data.rows.length&&<p className={styles.zero}>Nenhuma linha de desempenho para este intervalo.</p>}
       {data.limitedToFirstPage&&<p className={styles.warning}>Exibindo apenas os primeiros 100 registros. Reduza o período ou use filtros para uma análise completa.</p>}
    </section>
   </>}
   <div className={styles.footer}><div><BarChart3 size={16}/><span>Meta Ads: dados e atribuição próprios da Meta. Visitas da Meta e sessões internas do JotaFy podem divergir.</span></div>
     <button disabled={actionBusy} onClick={()=>{if(confirm("Desconectar a Meta Ads deste painel?"))void post({action:"disconnect"})}}><Unplug size={15}/> Desconectar</button></div>
  </>}
 </div>;
}
