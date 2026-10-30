"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpRight,BookOpen,CheckCircle2,Download,ExternalLink,Info,LockKeyhole,Plus,Radio,RefreshCw,Search,Settings2} from "lucide-react";
import styles from "./product-workspace.module.css";

type Product={id:string;name:string;description:string;price_cents:number;currency:"BRL";image_url:string;status:"live"|"draft"|"archived";revision:number};
type Settings={pixelId:string;capiPaused:boolean;available:boolean};
const money=(n:number)=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function ProductWorkspace({product,settings,pixel,paused,dirty,saving,onPixelChange,onPausedChange,onSave,onOpenSupport}:{
 product:{id:string;name:string;price:number}; settings:Settings;pixel:string;paused:boolean;dirty:boolean;saving:boolean;
 onPixelChange:(v:string)=>void;onPausedChange:(v:boolean)=>void;onSave:()=>Promise<void>;onOpenSupport:()=>void;
}){
 const [products,setProducts]=useState<Product[]>([]);
 const [selected,setSelected]=useState<Product|null>(null);
 const [creating,setCreating]=useState(false);
 const [tab,setTab]=useState<"general"|"pricing"|"delivery"|"tracking"|"advanced">("general");
 const [draft,setDraft]=useState({name:"",description:"",price_cents:1000,image_url:"",status:"draft" as Product["status"]});
 const [filter,setFilter]=useState("");
 const [priceText,setPriceText]=useState("10.00");
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [changed,setChanged]=useState(false);
 const refresh=async()=>{
  setLoading(true);setError("");
  try{const res=await fetch("/api/admin/products",{cache:"no-store"});const data=await res.json() as {products?:Product[];error?:string};
   if(!res.ok)throw Error(data.error||"Erro ao carregar produtos.");setProducts(data.products||[]);
  }catch(e){setError((e as Error).message)}finally{setLoading(false);}
 };
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{
  const block=(e:BeforeUnloadEvent)=>{if(changed){e.preventDefault()}};
  window.addEventListener("beforeunload",block);return()=>window.removeEventListener("beforeunload",block);
 },[changed]);
 const open=(p:Product)=>{setPriceText((p.price_cents/100).toFixed(2));setSelected(p);setDraft({name:p.name,description:p.description,price_cents:p.price_cents,image_url:p.image_url,status:p.status});setCreating(false);setChanged(false);setTab("general");setNotice("");setError("")};
 const create=()=>{setPriceText("10.00");setSelected(null);setCreating(true);setDraft({name:"",description:"",price_cents:1000,image_url:"",status:"draft"});setTab("general");setChanged(false);setNotice("");setError("")};
 const change=(field:keyof typeof draft,value:string|number)=>{setDraft(x=>({...x,[field]:value}));setChanged(true)};
 const save=async()=>{
  setSending(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/admin/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    action:creating?"create":"update",...(creating?{}:{id:selected?.id,revision:selected?.revision}),...draft
   })});
   const value=await res.json() as {id?:string;products?:Product[];error?:string};
   if(!res.ok)throw Error(value.error||"Falha ao salvar produto.");
   setProducts(value.products||[]);
   const fresh=value.products?.find(p=>p.id===value.id)||null;
   setSelected(fresh);setCreating(false);setChanged(false);setNotice("Produto salvo no catálogo.");
  }catch(e){setError((e as Error).message)}finally{setSending(false)}
 };
 const close=()=>{if(changed&&!confirm("Descartar alterações não salvas?"))return;setCreating(false);setSelected(null);setChanged(false);setError("");setNotice("")};
 const editor=creating||selected!==null;
 const matches=products.filter(p=>(p.name+" "+p.id).toLowerCase().includes(filter.toLowerCase()));
 return <div className={styles.workspace}>
  <div className={styles.hero}>
   <div><p className={styles.kicker}>JOTAFY / CATÁLOGO</p><h2>{editor?creating?"Novo produto":selected?.name:"Seus produtos"}</h2><p>{editor?"Configure o cadastro e as integrações disponíveis.":"Cadastre produtos e edite os dados existentes."}</p></div>
   {editor?<button className={styles.ghost} onClick={close}><ArrowLeft size={15}/> Voltar aos produtos</button>:
   <button className={styles.primary} onClick={create}><Plus size={16}/> Adicionar produto</button>}
  </div>
  {!!error&&<p role="alert" className={styles.warn}>{error}</p>}
  {!!notice&&<p role="status" className={styles.successMessage}>{notice}</p>}
  {!editor&&<>
   <div className={styles.productStats}>
    <div><span>PRODUTOS CADASTRADOS</span><strong>{products.length}</strong><small>Inclui rascunhos</small></div>
    <div><span>EM PRODUÇÃO</span><strong>{products.filter(p=>p.status==="live").length}</strong><small>Checkout atualmente integrado</small></div>
    <div><span>EM PREPARAÇÃO</span><strong>{products.filter(p=>p.status==="draft").length}</strong><small>Produtos ainda não vendáveis</small></div>
   </div>
   <div className={styles.toolbar}><label className={styles.search}><Search size={16}/><input aria-label="Buscar produtos" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar por nome ou ID"/></label>
    <button onClick={()=>void refresh()} className={styles.ghost} disabled={loading}><RefreshCw size={14}/> Atualizar</button>
   </div>
   {loading?<p role="status" className={styles.explainer}>Carregando catálogo…</p>:matches.length?
   <div className={styles.tableScroll}><table className={styles.catalogTable}><thead><tr><th>Produto</th><th>Preço cadastrado</th><th>Estado</th><th>Ações</th></tr></thead><tbody>
   {matches.map(p=><tr key={p.id}>
    <td><div className={styles.tableProduct}>{p.image_url?<img src={p.image_url} width={38} height={54} alt=""/>:<BookOpen size={28}/>}<span>{p.name}<small>{p.id}</small></span></div></td>
    <td data-label="Preço">{money(p.price_cents)}</td>
    <td data-label="Estado"><span className={styles.status}>{p.status==="live"?"Em produção":p.status==="draft"?"Rascunho":"Arquivado"}</span></td>
    <td data-label="Ação"><button onClick={()=>open(p)}>Configurar <ArrowUpRight size={15}/></button></td>
   </tr>)}</tbody></table></div>:
   <div className={styles.empty}><Search size={26}/><h3>Nenhum produto encontrado</h3><p>{products.length?"Altere o termo da busca.":"Crie o primeiro rascunho de produto."}</p></div>}
   <p className={styles.explainer}><Info size={15}/> Produtos adicionais ficam salvos no banco como rascunhos. Para vender um novo produto, ainda será necessário integrar seu checkout, entrega e validação financeira.</p>
  </>}
  {editor&&<>
   <div className={styles.editorLayout}>
    <nav className={styles.editorNav} aria-label="Seções do produto">
     {([["general","Informações gerais",BookOpen],["pricing","Preço e cobrança",Settings2],["delivery","Entrega e acesso",Download],["tracking","Rastreamento",Radio],["advanced","Avançado",LockKeyhole]] as const).map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={tab===id?styles.selected:""} aria-current={tab===id?"page":undefined}><Icon size={17}/><span>{label}</span></button>)}
    </nav>
    <div className={styles.editorBody}>
     {tab==="general"&&<section className={styles.section}><h4>Informações gerais</h4><div className={styles.catalogForm}>
      <label>Nome do produto<input required maxLength={120} value={draft.name} onChange={e=>change("name",e.target.value)} placeholder="Ex.: E-book de receitas"/></label>
      <label>Descrição<textarea rows={4} maxLength={1500} value={draft.description} onChange={e=>change("description",e.target.value)} placeholder="Descreva o produto"/></label>
      <label>Caminho interno da imagem<input maxLength={240} value={draft.image_url} onChange={e=>change("image_url",e.target.value)} placeholder="/imagens/capa.webp"/></label>
      <p className={styles.readOnly}><Info size={15}/> Essas informações são armazenadas no catálogo administrativo. A página de vendas atual permanece configurada no código.</p>
     </div></section>}
     {tab==="pricing"&&<section className={styles.section}><h4>Preço e pagamento</h4><div className={styles.catalogForm}><label>Preço (R$)<input type="number" min={1} max={1000000} step=".01" value={priceText} disabled={selected?.status==="live"} onChange={e=>{setPriceText(e.target.value);change("price_cents",Math.round(Number(e.target.value)*100))}}/></label>
      <p className={styles.readOnly}><LockKeyhole size={15}/> {selected?.status==="live"?"O preço do produto vendido está protegido pelo checkout real (R$ 10,00). Não pode ser alterado isoladamente.":"O valor fica salvo como configuração do rascunho. Não ativa cobranças automaticamente."}</p>
     </div></section>}
     {tab==="delivery"&&<section className={styles.section}><h4>Entrega e acesso</h4><p>{selected?.status==="live"?"Entrega protegida do PDF atual pelo R2 e controle de acesso por pagamento aprovado.":"Entrega ainda não vinculada. Produto não pode receber pagamentos até ser configurado."}</p><button className={styles.ghost} onClick={onOpenSupport}>Abrir atendimento <ArrowUpRight size={15}/></button></section>}
     {tab==="tracking"&&<section className={styles.section}><h4>Meta Pixel e API de Conversões</h4>{selected?.status==="live"?<form onSubmit={async e=>{e.preventDefault();await onSave()}} className={styles.settingsForm}>
       <label htmlFor="product-meta-pixel">ID do Pixel<input id="product-meta-pixel" type="text" pattern="[0-9]{5,30}" required value={pixel} onChange={e=>onPixelChange(e.target.value)}/></label>
       <label className={styles.settingSwitch}><input type="checkbox" checked={paused} onChange={e=>onPausedChange(e.target.checked)}/><span><strong>Pausar o envio da CAPI</strong><small>Não interfere na cobrança.</small></span></label>
       <div className={styles.saveBar}><span>{dirty?"Rastreamento com alterações não salvas":"Configurações sincronizadas"}</span><button type="submit" className={styles.primary} disabled={!dirty||saving||!settings.available}>{saving?"Salvando…":"Salvar rastreamento"}</button></div>
      </form>:<p className={styles.readOnly}>A integração de eventos será habilitada quando houver checkout e entrega próprios para esse produto.</p>}</section>}
     {tab==="advanced"&&<section className={styles.section}><h4>Estado do produto</h4><p>ID: {selected?.id||"Gerado ao salvar"}</p><div className={styles.catalogForm}><label>Estado cadastral<select disabled={creating||selected?.status==="live"} value={draft.status} onChange={e=>change("status",e.target.value)}><option value="draft">Rascunho</option><option value="archived">Arquivado</option>{selected?.status==="live"&&<option value="live">Em produção</option>}</select></label></div>
      <p className={styles.readOnly}><LockKeyhole size={15}/> Não é possível ativar novos produtos sem um checkout completo, entrega e validações próprias.</p></section>}
     {tab!=="tracking"&&<div className={styles.saveBar}><span role="status">{changed?"Alterações no cadastro não salvas":"Cadastro sem alterações pendentes"}</span><button className={styles.primary} type="button" disabled={!changed||sending} onClick={()=>void save()}>{sending?"Salvando…":creating?"Criar rascunho":"Salvar produto"}</button></div>}
    </div>
   </div>
  </>}
 </div>;
}
