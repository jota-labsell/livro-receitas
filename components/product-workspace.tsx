"use client";
import { useState } from "react";
import {
  ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, ChevronRight, CreditCard,
  Download, ExternalLink, Eye, FileText, Grid2X2, Info, LayoutList, Link2,
  LockKeyhole, Radio, Search, Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal,
} from "lucide-react";
import styles from "./product-workspace.module.css";

type Product = { id: string; name: string; price: number };
type Settings = { pixelId: string; capiPaused: boolean; available: boolean };
type Panel = "general" | "pricing" | "methods" | "checkout" | "delivery" | "tracking" | "advanced";
const sections: { id: Panel; label: string; help: string; icon: typeof BookOpen }[] = [
  { id: "general", label: "Informações gerais", help: "Identificação e apresentação", icon: BookOpen },
  { id: "pricing", label: "Preço e cobrança", help: "Modelo comercial em produção", icon: ShoppingBag },
  { id: "methods", label: "Métodos de pagamento", help: "Integração Mercado Pago", icon: CreditCard },
  { id: "checkout", label: "Checkout", help: "Fluxo publicado e prévia", icon: LayoutList },
  { id: "delivery", label: "Entrega e acesso", help: "Download e autorização", icon: Download },
  { id: "tracking", label: "Rastreamento", help: "Meta Pixel e CAPI", icon: Radio },
  { id: "advanced", label: "Avançado", help: "Configurações administradas no código", icon: Settings2 },
];
const brl = (price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function Property({ name, value, note }: { name: string; value: string; note?: string }) {
  return <div className={styles.property}><dt>{name}</dt><dd>{value}</dd>{note && <small>{note}</small>}</div>;
}
function ReadOnly({ children }: { children: React.ReactNode }) {
  return <p className={styles.readOnly}><LockKeyhole size={15} aria-hidden="true" />{children}</p>;
}
export function ProductWorkspace({
  product, settings, pixel, paused, dirty, saving, onPixelChange, onPausedChange, onSave, onOpenSupport,
}: {
  product: Product; settings: Settings; pixel: string; paused: boolean; dirty: boolean; saving: boolean;
  onPixelChange: (value: string) => void; onPausedChange: (value: boolean) => void;
  onSave: () => Promise<void>; onOpenSupport: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<Panel>("general");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"cards" | "table">("cards");
  const matches = [product].filter(p => (p.name + " " + p.id).toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.workspace}>
    {!editing ? <>
      <div className={styles.hero}>
        <div><p className={styles.kicker}>CATÁLOGO / 1 PRODUTO CONFIGURADO</p><h2>Seus produtos</h2><p>Gerencie o conteúdo publicado, a entrega e o rastreamento em um só lugar.</p></div>
        <a className={styles.ghost} href="/" target="_blank" rel="noreferrer"><Eye size={17}/> Ver página de vendas <ExternalLink size={14}/></a>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17}/><span className={styles.srOnly}>Buscar produtos</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome ou identificador"/></label>
        <div className={styles.toolbarRight}><span className={styles.counter}>{matches.length} de 1 produto</span>
          <div className={styles.toggle} role="group" aria-label="Modo de exibição">
            <button type="button" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")} aria-label="Ver cartões"><Grid2X2 size={17}/></button>
            <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")} aria-label="Ver tabela"><LayoutList size={17}/></button>
          </div>
        </div>
      </div>
      {!matches.length ? <div className={styles.empty}><Search size={28}/><h3>Nenhum produto encontrado</h3><p>Tente outro nome ou identificador.</p><button onClick={() => setQuery("")}>Limpar busca</button></div> :
      layout === "cards" ? <div className={styles.cards}>{matches.map(p => <article className={styles.productCard} key={p.id}>
        <img src="/ebook/page-0.webp" width={104} height={148} alt="Capa do produto 150 Doces para Comer e Vender" />
        <div className={styles.cardBody}><div className={styles.status}><CheckCircle2 size={13}/> Produto configurado</div><h3>{p.name}</h3><p>E-book digital · pagamento único · acesso privado em PDF</p>
          <div className={styles.cardBottom}><strong>{brl(p.price)}</strong><button onClick={() => {setPanel("general");setEditing(true)}}>Gerenciar <ChevronRight size={16}/></button></div>
        </div>
      </article>)}</div> :
      <div className={styles.tableScroll}><table className={styles.catalogTable}><thead><tr><th>Produto</th><th>Preço</th><th>Modelo</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{matches.map(p=><tr key={p.id}><td><div className={styles.tableProduct}><img src="/ebook/page-0.webp" alt="" width={38} height={54}/><span>{p.name}<small>{p.id}</small></span></div></td><td>{brl(p.price)}</td><td>Único · Digital</td><td><span className={styles.status}><CheckCircle2 size={13}/> Configurado</span></td><td><button onClick={() => {setPanel("general");setEditing(true)}}>Gerenciar <ChevronRight size={15}/></button></td></tr>)}</tbody></table></div>}
      <p className={styles.explainer}><Info size={15}/> O catálogo reflete o produto realmente cadastrado na aplicação. Não há API de criação de múltiplos produtos nesta versão.</p>
    </> : <>
      <div className={styles.editorTop}>
        <button className={styles.back} onClick={() => setEditing(false)}><ArrowLeft size={16}/> Produtos</button>
        <div className={styles.editorIdentity}><img src="/ebook/page-0.webp" alt="" width={44} height={60}/><div><span className={styles.kicker}>PRODUTO DIGITAL</span><h2>{product.name}</h2><p>{product.id} · {brl(product.price)}</p></div></div>
        <a className={styles.ghost} href="/" target="_blank" rel="noreferrer"><ExternalLink size={15}/> Ver oferta</a>
      </div>
      <div className={styles.editorLayout}>
        <nav className={styles.editorNav} aria-label="Seções do produto">
          {sections.map(({id,label,icon:Icon})=><button key={id} className={panel===id?styles.selected:""} aria-current={panel===id?"page":undefined} onClick={()=>setPanel(id)}><Icon size={17}/><span>{label}</span><ChevronRight size={14}/></button>)}
        </nav>
        <div className={styles.editorBody}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>CONFIGURAÇÕES DO PRODUTO</p><h3>{sections.find(s=>s.id===panel)?.label}</h3><p>{sections.find(s=>s.id===panel)?.help}</p></div>{dirty && <span className={styles.unsaved}>Alterações não salvas</span>}</div>
          {panel==="general" && <section className={styles.section}><h4>Identidade e conteúdo</h4><div className={styles.mediaRow}><img src="/ebook/page-0.webp" alt="Capa do e-book 150 Doces" width={92} height={130}/><div><strong>{product.name}</strong><p>150 receitas organizadas em edição fotográfica. Produto entregue por download após confirmação de pagamento.</p><span className={styles.status}><CheckCircle2 size={13}/> Arquivo vinculado</span></div></div><dl className={styles.properties}><Property name="ID do produto" value={product.id}/><Property name="Tipo" value="Produto digital · PDF"/><Property name="Acesso" value="Entrega privada após pagamento aprovado"/></dl><ReadOnly>Nome, imagem e conteúdo são administrados na configuração do projeto; esta interface não possui edição desses campos.</ReadOnly></section>}
          {panel==="pricing" && <section className={styles.section}><h4>Preço e modelo de cobrança</h4><div className={styles.priceCard}><span>Preço de venda</span><strong>{brl(product.price)}</strong><small>Pagamento único em reais (BRL)</small></div><dl className={styles.properties}><Property name="Modelo" value="Pagamento único"/><Property name="Moeda" value="BRL"/><Property name="Provedor" value="Mercado Pago"/></dl><ReadOnly>O preço é validado no servidor. Alterá-lo exige revisão conjunta de checkout, pagamentos e eventos de compra, além dos testes financeiros.</ReadOnly></section>}
          {panel==="methods" && <section className={styles.section}><h4>Meios de pagamento</h4><div className={styles.featureList}><div><CreditCard/><span><strong>Cartões</strong><small>Métodos disponíveis são consultados ao Mercado Pago para cada sessão.</small></span></div><div><Link2/><span><strong>Pix</strong><small>Disponibilidade e instruções são fornecidas pelo provedor em tempo real.</small></span></div></div><ReadOnly>A ativação de cada meio de pagamento é controlada pelo provedor e pelo backend. Não há opções locais editáveis para esses métodos.</ReadOnly></section>}
          {panel==="checkout" && <section className={styles.section}><h4>Experiência do comprador</h4><div className={styles.featureList}><div><ShieldCheck/><span><strong>Checkout integrado</strong><small>Pagamento dentro da página, usando o SDK oficial do Mercado Pago.</small></span></div><div><FileText/><span><strong>Confirmação</strong><small>A aprovação ocorre no backend antes da liberação do acesso.</small></span></div></div><a className={styles.actionLink} href="/#checkout" target="_blank" rel="noreferrer">Abrir checkout publicado <ArrowUpRight size={16}/></a><ReadOnly>A prévia abre a página real. Layout do checkout e configuração do provedor são modificados no código, não por este painel.</ReadOnly></section>}
          {panel==="delivery" && <section className={styles.section}><h4>Entrega e recuperação</h4><div className={styles.featureList}><div><Download/><span><strong>PDF privado no R2</strong><small>Download autorizado após confirmação da compra; arquivo completo não é público.</small></span></div><div><LockKeyhole/><span><strong>Acesso e reembolso</strong><small>O sistema verifica o pedido antes da entrega; estornos podem revogar o acesso.</small></span></div></div><button className={styles.primary} onClick={onOpenSupport}>Abrir atendimento e acessos <ArrowUpRight size={16}/></button></section>}
          {panel==="tracking" && <section className={styles.section}><h4>Meta Pixel e API de Conversões</h4><p>Esta é a seção editável. As alterações são salvas no servidor e registradas em auditoria.</p><form onSubmit={async e=>{e.preventDefault();await onSave()}} className={styles.settingsForm}>
            <label htmlFor="product-meta-pixel">ID do Pixel <input id="product-meta-pixel" type="text" inputMode="numeric" autoComplete="off" required pattern="[0-9]{5,30}" value={pixel} onChange={e=>onPixelChange(e.target.value)} aria-describedby="pixel-hint"/></label><p id="pixel-hint" className={styles.formHint}>De 5 a 30 dígitos. A mudança vale para novas páginas e novos pedidos.</p>
            <label className={styles.settingSwitch}><input type="checkbox" checked={paused} onChange={e=>onPausedChange(e.target.checked)}/><span><strong>Pausar envio automático da CAPI</strong><small>Não interrompe o checkout e não altera o estado das compras.</small></span></label>
            <div className={styles.saveBar}><span role="status">{dirty ? "Alterações ainda não foram salvas" : "Configuração sincronizada"}</span><button type="submit" className={styles.primary} disabled={saving || !dirty || !settings.available}>{saving?"Salvando…":"Salvar alterações"}</button></div>
            {!settings.available && <p className={styles.warn}>Configuração indisponível no servidor. Verifique a migration de operações.</p>}
          </form></section>}
          {panel==="advanced" && <section className={styles.section}><h4>Infraestrutura e segurança</h4><dl className={styles.properties}><Property name="Plataforma" value="Cloudflare Workers"/><Property name="Banco de pedidos" value="D1 (privado)"/><Property name="Entrega" value="R2 (privado)"/><Property name="Processamento de pagamentos" value="Mercado Pago Orders"/><Property name="Privacidade" value="Preferências de medição respeitadas"/></dl><ReadOnly>Credenciais, webhooks, validações de pagamento e migrations não são editáveis por este módulo. Nenhum segredo é disponibilizado ao navegador.</ReadOnly></section>}
          <p className={styles.editorFooter}><SlidersHorizontal size={15}/> Configurações exibidas conforme as capacidades reais da aplicação.</p>
        </div>
      </div>
    </>}
  </div>;
}
