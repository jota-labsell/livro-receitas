"use client";
import {
  ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, HelpCircle,
  MousePointerClick, Radio, ShoppingBag, TrendingUp,
} from "lucide-react";
import styles from "./executive-overview.module.css";

type Campaign = { source: string; medium: string; campaign: string; sessions: number; orders: number; approved: number; revenue: number };
type OverviewData = {
  summary: { orders: number; revenue: number; approved: number; pending: number; reversed: number; pending_amount?: number };
  days: { day: string; orders: number; revenue: number }[];
  campaigns: Campaign[];
  funnel: Record<string, number> | null;
  trackingAvailable: boolean;
  services: { database: boolean; ebook: boolean | null; paymentsConfigured: boolean; metaConfigured: boolean };
  settings: { capiPaused: boolean };
  product: { name: string };
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const number = (value: number) => value.toLocaleString("pt-BR");
const percent = (part: number, total: number) => total > 0 ? `${(100 * part / total).toFixed(1).replace(".", ",")}%` : "—";
const stages = [
  ["sessions", "Entradas"],
  ["views", "Visualização"],
  ["clicks", "Cliques CTA"],
  ["checkouts", "Checkouts"],
  ["orders", "Pedidos"],
  ["approved", "Aprovados"],
] as const;

function RevenueLine({ days }: { days: OverviewData["days"] }) {
  if (!days.length) {
    return <div className={styles.noChart} role="status">
      <TrendingUp size={24} aria-hidden="true"/>
      <strong>Nenhum pedido registrado neste período</strong>
      <span>Quando houver pedidos, a evolução da receita aparecerá aqui.</span>
    </div>;
  }
  const sorted = [...days].sort((a,b) => a.day.localeCompare(b.day));
  const max = Math.max(1, ...sorted.map(d => d.revenue));
  const coordinates = sorted.map((d,i) => {
    const x = sorted.length === 1 ? 500 : 35 + (930 * i / (sorted.length - 1));
    return { x, y: 220 - 185 * (Math.max(0, d.revenue) / max), day: d.day, revenue: d.revenue };
  });
  const points = coordinates.map(d => `${d.x},${d.y}`).join(" ");
  const area = `35,220 ${points} 965,220`;
  const tick = (n: number) => money(Math.round(max * n));
  return <div className={styles.graph}>
    <div className={styles.graphLabel}><span>{tick(1)}</span><span>{tick(.5)}</span><span>R$ 0,00</span></div>
    <div className={styles.svgWrap}>
      <svg viewBox="0 0 1000 245" preserveAspectRatio="none" role="img" aria-label="Evolução da receita aprovada por dia">
        <defs><linearGradient id="jotafy-revenue-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#54cc99" stopOpacity=".23"/><stop offset="1" stopColor="#54cc99" stopOpacity="0"/></linearGradient></defs>
        <path d="M35 35 H965 M35 127 H965 M35 220 H965" stroke="#344438" strokeDasharray="4 8" fill="none"/>
        {sorted.length > 1 && <polygon points={area} fill="url(#jotafy-revenue-area)"/>}
        <polyline points={points} stroke="#74ddae" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" fill="none"/>
        {coordinates.map((d,i)=><circle key={i} cx={d.x} cy={d.y} r="4.5" fill="#b1ffce" stroke="#244b37" strokeWidth="2"><title>{d.day}: {money(d.revenue)}</title></circle>)}
      </svg>
      <div className={styles.axisLabels}>
        {sorted.map((d,i) => <span key={d.day} style={{left: `${sorted.length === 1 ? 50 : 3.5 + 93 * i / (sorted.length-1)}%`}} title={d.day}>{d.day.slice(8)}/{d.day.slice(5,7)}</span>)}
      </div>
    </div>
  </div>;
}

export function ExecutiveOverview({ data, onOrders, onCampaigns, onMeta, onProduct }: {
  data: OverviewData;
  onOrders: () => void;
  onCampaigns: () => void;
  onMeta: () => void;
  onProduct: () => void;
}) {
  const s = data.summary;
  const base = data.funnel?.sessions || 0;
  const linked = data.campaigns.reduce((n,c) => n + (c.approved || 0), 0);
  const topCampaigns = data.campaigns.slice().sort((a,b) => b.revenue - a.revenue).slice(0,5);
  const checks = [
    { label: "Pagamentos", ok: data.services.paymentsConfigured, value: data.services.paymentsConfigured ? "Configuração presente" : "Verificar integração" },
    { label: "Meta CAPI", ok: data.services.metaConfigured && !data.settings.capiPaused, value: data.settings.capiPaused ? "Envio pausado" : data.services.metaConfigured ? "Configuração presente" : "Verificar integração" },
    { label: "E-book privado", ok: data.services.ebook === true, value: data.services.ebook === true ? "Arquivo localizado" : data.services.ebook === false ? "Arquivo não encontrado" : "Não verificado" },
  ];
  return <div className={styles.overview}>
    <div className={styles.sectionIntro}>
      <div><span className={styles.overline}>DESEMPENHO DO NEGÓCIO</span><h2>Seus resultados, em uma visão.</h2></div>
      <span className={styles.dataTag}><CheckCircle2 size={14}/> Dados da sua operação</span>
    </div>
    <div className={styles.headlineGrid}>
      <section className={styles.revenueHero} aria-label="Receita aprovada">
        <div className={styles.heroEyebrow}><span>Receita aprovada</span><CheckCircle2 size={17}/></div>
        <strong className={styles.revenueAmount}>{money(s.revenue)}</strong>
        <div className={styles.heroFooter}><span>Pedidos criados no período e atualmente aprovados. Antes de taxas.</span><button type="button" onClick={onOrders}>Ver vendas <ArrowUpRight size={15}/></button></div>
      </section>
      <section className={styles.quickStats} aria-label="Resumo de vendas">
        <div><span>Vendas aprovadas</span><strong>{number(s.approved || 0)}</strong><small>Compras confirmadas</small></div>
        <div><span>Ticket médio</span><strong>{s.approved ? money(s.revenue / s.approved) : "—"}</strong><small>Por venda aprovada</small></div>
        <div><span>Aprovação</span><strong>{percent(s.approved || 0, s.orders)}</strong><small>Dos pedidos criados</small></div>
        <div><span>Pedidos pendentes</span><strong>{number(s.pending || 0)}</strong><small>{money(s.pending_amount || 0)} aguardando</small></div>
      </section>
    </div>

    <div className={styles.analysisGrid}>
      <section className={styles.chartCard}>
        <header className={styles.cardHead}><div><h3>Evolução do faturamento</h3><p>Receita dos pedidos criados no período, atualmente aprovados</p></div><span className={styles.kpiChip}>BRL</span></header>
        <RevenueLine days={data.days}/>
        <div className={styles.chartFooter}><span><i/> Receita aprovada</span><span>Investimento em anúncios não conectado</span></div>
      </section>
      <section className={styles.funnelCard}>
        <header className={styles.cardHead}><div><h3>Funil do site</h3><p>Por sessões registradas</p></div><MousePointerClick size={18} aria-hidden="true"/></header>
        {!data.trackingAvailable ? <div className={styles.stateMessage}>Rastreamento de sessões indisponível. Confira as configurações.</div> :
        !base ? <div className={styles.stateMessage}>Sem entradas registradas para o período selecionado.</div> :
        <div className={styles.funnelList} role="list">
          {stages.map(([key,label])=>{
            const count = data.funnel?.[key] || 0;
            return <div className={styles.funnelRow} key={key} role="listitem">
              <div className={styles.funnelTop}><span>{label}</span><strong>{number(count)}</strong><small>{percent(count,base)}</small></div>
              <div className={styles.track}><span style={{width: `${Math.min(100,100*count/base)}%`}}/></div>
            </div>;
          })}
        </div>}
        <p className={styles.funnelNote}>Etapas independentes por sessão. Cliques em anúncios não são medidos aqui.</p>
      </section>
    </div>

    <div className={styles.detailGrid}>
      <section className={styles.campaignCard}>
        <header className={styles.cardHead}><div><h3>Origens e campanhas</h3><p>Atribuição interna por primeira sessão, não equivalente à Meta Ads</p></div><button type="button" className={styles.smallLink} onClick={onCampaigns}>Explorar <ArrowRight size={16}/></button></header>
        <div className={styles.tableOverflow}>
          <table><thead><tr><th>Campanha / origem</th><th>Sessões</th><th>Vendas</th><th>Receita</th></tr></thead><tbody>
            {topCampaigns.map((c,i)=><tr key={i}><td><strong>{c.campaign || "Sem campanha informada"}</strong><span>{c.source || "Sem origem"} · {c.medium || "sem meio"}</span></td><td>{number(c.sessions)}</td><td>{number(c.approved)}</td><td>{money(c.revenue)}</td></tr>)}
          </tbody></table>
        </div>
        {!topCampaigns.length && <p className={styles.stateMessage}>As campanhas aparecerão após as primeiras sessões rastreadas.</p>}
        <div className={styles.cardFoot}>Pedidos aprovados associados às origens exibidas no relatório: <strong>{number(linked)}</strong></div>
      </section>
      <section className={styles.operationsCard}>
        <header className={styles.cardHead}><div><h3>Operação</h3><p>Status de configuração</p></div><Radio size={18} aria-hidden="true"/></header>
        <div className={styles.healthList}>{checks.map(x=><div key={x.label}><span className={x.ok?styles.okDot:styles.attentionDot}/><span><strong>{x.label}</strong><small>{x.value}</small></span></div>)}</div>
        <p className={styles.disclaimer}>Configuração não garante disponibilidade externa nem recebimento de eventos.</p>
        <button type="button" className={styles.outlineButton} onClick={onMeta}>Diagnóstico Meta <ArrowUpRight size={15}/></button>
      </section>
    </div>

    <div className={styles.nextSteps}><span><HelpCircle size={17}/> Gastos, ROAS, CPA e lucro só serão calculados quando houver integração confiável com a conta de anúncios e custos.</span><button type="button" onClick={onProduct}>Gerenciar produto <ArrowRight size={16}/></button></div>
  </div>;
}
