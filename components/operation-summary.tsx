"use client";
import { Info, ArrowUpRight, ShieldCheck, Radio } from "lucide-react";
import styles from "./management-dashboard.module.css";
type SummaryData = {
  summary: {
    orders: number;
    revenue: number;
    approved: number;
    pending: number;
    reversed: number;
    pending_amount?: number;
    refunded_amount?: number;
    chargeback_amount?: number;
    rejected?: number;
  };
  funnel: Record<string, number> | null;
  trackingAvailable: boolean;
  campaigns: {
    source: string;
    campaign: string;
    sessions: number;
    approved: number;
    revenue: number;
  }[];
  product: { name: string };
  meta: { state: string; total: number; max_attempts: number }[] | null;
  settings: { capiPaused: boolean };
  services: { metaConfigured: boolean };
};
const money = (n: number) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const amount = (n: number | undefined) => (n === undefined ? "—" : money(n));
const percent = (n: number, d: number) =>
  d ? `${((n / d) * 100).toFixed(1)}%` : "—";
function Metric({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`${styles.statCard} ${highlight ? styles.statHighlight : ""}`}
    >
      <div className={styles.statLabel}>
        <span>{label}</span>
        <details className={styles.help}>
          <summary aria-label={`Sobre ${label}`}>
            <Info size={14} />
          </summary>
          <p>{note}</p>
        </details>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export function OperationSummary({
  data,
  onOpenMeta,
  onOpenSources,
}: {
  data: SummaryData;
  onOpenMeta: () => void;
  onOpenSources: () => void;
}) {
  const s = data.summary,
    base = data.funnel?.sessions || 0;
  const stages = [
    ["sessions", "Entradas"],
    ["views", "Vis. oferta"],
    ["clicks", "Cliques CTA"],
    ["checkouts", "Checkouts"],
    ["orders", "Pedidos"],
    ["approved", "Aprovados"],
  ];
  const sent =
    data.meta
      ?.filter((x) => x.state === "sent")
      .reduce((sum, x) => sum + x.total, 0) || 0;
  const issues =
    data.meta
      ?.filter((x) => x.state !== "sent" && x.max_attempts >= 12)
      .reduce((sum, x) => sum + x.total, 0) || 0;
  const sources = Object.values(
    data.campaigns.reduce<
      Record<string, { source: string; revenue: number; sessions: number }>
    >((acc, c) => {
      const row = acc[c.source] || {
        source: c.source,
        revenue: 0,
        sessions: 0,
      };
      row.revenue += c.revenue;
      row.sessions += c.sessions;
      acc[c.source] = row;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);
  const attributedOrders = data.campaigns.reduce((total, row) => total + (row.approved || 0), 0);
  return (
    <div className={styles.operationSummary}>
      <div className={styles.primaryStats}>
        <Metric
          label="Receita aprovada"
          value={money(s.revenue)}
          note="Valor dos pedidos criados no período e atualmente aprovados. Taxas não descontadas."
          highlight
        />
        <Metric
          label="Gastos com anúncios"
          value="—"
          note="Sem conexão com a conta de anúncios. Investimento ainda não importado."
        />
        <Metric
          label="ROAS"
          value="—"
          note="Depende de investimento e receita com a mesma regra de atribuição."
        />
        <Metric
          label="Lucro estimado"
          value="—"
          note="Exige gastos, taxas e custos reais. Não calculado a partir apenas da receita."
        />
        <Metric label="Vendas aprovadas" value={(s.approved || 0).toLocaleString("pt-BR")} note="Pedidos criados no período que estão aprovados atualmente." />
        <Metric label="CPA" value="—" note="Custo por aquisição: exige investimento e correspondência entre campanhas e vendas." />
        <Metric label="Taxa de reembolso" value="—" note="A API atual oferece o valor reembolsado, mas não a contagem total de reembolsos do período." />
        <Metric label="Pedidos atribuídos" value={attributedOrders.toLocaleString("pt-BR")} note="Pedidos aprovados ligados às origens das sessões no período. Atribuição interna, diferente da Meta Ads." />
      </div>
      <div className={styles.operationGrid}>
        <section className={`${styles.panel} ${styles.conversionPanel}`}>
          <div className={styles.sectionTitle}>
            <h2>
              Funil de conversão <span>Site</span>
            </h2>
            <span className={styles.chip}>Por sessão</span>
          </div>
          <p>Sessões iniciadas no período, acompanhadas até agora.</p>
          {!data.trackingAvailable ? (
            <p className={styles.notice}>
              A coleta de sessões ainda não está disponível. Confira a
              configuração do rastreamento.
            </p>
          ) : (
            <div className={styles.funnelRows} role="list" aria-label="Etapas do funil de conversão">
              {stages.map(([key, label]) => {
                const n = data.funnel?.[key] || 0;
                const p = base ? (n / base) * 100 : 0;
                return <div key={key} className={styles.funnelRow} role="listitem">
                  <span>{label}</span>
                  <div className={styles.funnelBar} role="img" aria-label={`${label}: ${n} sessões, ${base ? p.toFixed(1) + "%" : "sem base"}`}>
                    <i style={{ width: `${Math.min(100, Math.max(0, p))}%` }}/>
                  </div>
                  <strong>{n.toLocaleString("pt-BR")}</strong>
                  <small>{base ? p.toFixed(1) + "%" : "—"}</small>
                </div>;
              })}
            </div>
          )}
          <p className={styles.footnote}>Percentuais calculados sobre as entradas registradas. As etapas representam sessões distintas, não cliques no anúncio.</p>
        </section>
        <div className={styles.statsColumn}>
          <div className={styles.secondaryStats}>
            <Metric label="Vendas pendentes" value={amount(s.pending_amount)} note={`${s.pending || 0} pedidos aguardando pagamento ou confirmação.`}/>
            <Metric label="Ticket médio" value={s.approved ? money(s.revenue / s.approved) : "—"} note="Receita aprovada dividida pelas compras aprovadas."/>
            <Metric label="Aprovação de pedidos" value={percent(s.approved || 0, s.orders)} note={`${s.approved || 0} aprovados entre ${s.orders || 0} pedidos criados no período, incluindo pendentes.`}/>
          </div>
          <details className={styles.financialDetails}>
            <summary>Outros indicadores financeiros <span>6 indicadores adicionais</span></summary>
            <div className={styles.detailsStats}>
              <Metric label="Taxas de pagamento" value="—" note="Taxas reais do Mercado Pago ainda não importadas."/>
              <Metric label="Vendas reembolsadas" value={amount(s.refunded_amount)} note="Valor nominal dos pedidos com status reembolsado; não é um extrato de estornos parciais."/>
              <Metric label="Despesas adicionais" value="—" note="Despesas operacionais ainda não cadastradas."/>
              <Metric label="Chargebacks" value={amount(s.chargeback_amount)} note="Valor nominal dos pedidos atualmente contestados."/>
              <Metric label="Pedidos revertidos" value={percent(s.reversed || 0, s.orders)} note="Reembolsos e contestações sobre pedidos criados no período."/>
              <Metric label="Impostos e custos" value="—" note="Tributos e custos do produto ainda não informados. Nenhum valor presumido."/>
            </div>
          </details>
        </div>
      </div>
      <div className={styles.bottomStats}>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>Vendas por produto</h2>
            <span className={styles.chip}>Produto único</span>
          </div>
          <div className={styles.productLine}>
            <div className={styles.productMark}><img src="/ebook/page-0.webp" width="42" height="60" alt="" /></div>
            <div>
              <strong>{data.product.name}</strong>
              <small>{s.approved || 0} compras aprovadas</small>
            </div>
            <b>{money(s.revenue)}</b>
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>Receita por fonte</h2>
            <button
              className={styles.textButton}
              onClick={onOpenSources}
              aria-label="Ver origens e campanhas"
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          {sources.length ? (
            sources.map((row) => (
              <div key={row.source} className={styles.sourceLine}>
                <span>
                  {row.source}
                  <small>{row.sessions} sessões</small>
                </span>
                <strong>{money(row.revenue)}</strong>
              </div>
            ))
          ) : (
            <p className={styles.empty}>
              Sem origens rastreadas neste período.
            </p>
          )}
          <p className={styles.footnote}>
            Coorte das sessões iniciadas no período; pode diferir da receita por
            criação de pedido.
          </p>
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <h2>Conexão e entrega</h2>
            <ShieldCheck size={18} />
          </div>
          <div className={styles.connection}>
            <Radio size={18} />
            <div>
              <strong>API de Conversões</strong>
              <small>
                {data.settings.capiPaused
                  ? "Envio pausado"
                  : data.services.metaConfigured
                    ? "Configuração habilitada"
                    : "Configuração incompleta"}
              </small>
            </div>
          </div>
          <div className={styles.deliveryCounts}>
            <div>
              <strong>{sent}</strong>
              <small>envios aceitos</small>
            </div>
            <div>
              <strong>{issues}</strong>
              <small>envios interrompidos</small>
            </div>
          </div>
          <button className={styles.textButton} onClick={onOpenMeta}>
            Abrir diagnóstico <ArrowUpRight size={15} />
          </button>
          <p className={styles.footnote}>
            Fila global, sem filtro de período. Recebimento não comprova
            atribuição à campanha.
          </p>
        </section>
      </div>
    </div>
  );
}
