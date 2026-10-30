"use client";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  ChartNoAxesCombined,
  Settings2,
  Activity,
  BookOpen,
  ArrowUpRight,
  RefreshCw,
  Download,
  LogOut,
  Link2,
  LifeBuoy,
  Radio,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
  CalendarRange,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { OperationSummary } from "./operation-summary";
import { ExecutiveOverview } from "./executive-overview";
import { OperatorAccount } from "./operator-login";
import { AccessAdminScreen } from "./access-admin-screen";
import { MetaDiagnosticsScreen } from "./meta-diagnostics-screen";
import { ProductWorkspace } from "./product-workspace";
import styles from "./management-dashboard.module.css";
type Order = {
  id: string;
  status: string;
  amount_cents: number;
  created_at: number;
};
type Campaign = {
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  orders: number;
  approved: number;
  revenue: number;
};
type Data = {
  sources?: string[];
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
  days: { day: string; orders: number; revenue: number }[];
  orders: Order[];
  hasMore: boolean;
  page: number;
  campaigns: Campaign[];
  funnel: Record<string, number> | null;
  meta: { state: string; total: number; max_attempts: number }[] | null;
  push: { status: string; total: number }[] | null;
  health: { name: string; last_run: number }[];
  trackingAvailable: boolean;
  settings: { pixelId: string; capiPaused: boolean; available: boolean };
  product: { id: string; name: string; price: number };
  services: {
    database: boolean;
    ebook: boolean | null;
    paymentsConfigured: boolean;
    metaConfigured: boolean;
  };
  checkedAt: number;
};
const money = (n: number) =>
  ((n || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const time = (n: number) =>
  new Date(n).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const day = (delta = 0) =>
  new Date(Date.now() - 10800000 + delta * 86400000).toISOString().slice(0, 10);
const statuses: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  processing: "Processando",
  created: "Criado",
  rejected: "Recusado",
  refunded: "Reembolsado",
  charged_back: "Contestado",
  cancelled: "Cancelado",
};
const nav = [
  ["overview", "Visão geral", LayoutDashboard],
  ["orders", "Vendas e pedidos", ShoppingBag],
  ["operation", "Operação e campanhas", ChartNoAxesCombined],
  ["support", "Atendimento", LifeBuoy],
  ["meta", "API da Meta", Radio],
  ["health", "Saúde dos serviços", Activity],
  ["product", "Produtos", BookOpen],
  ["account", "Minha conta", Settings2],
] as const;
const navGroups = [
  { title: "ANÁLISE", keys: ["overview", "operation", "orders"] },
  { title: "GESTÃO", keys: ["product", "support"] },
  { title: "SISTEMA", keys: ["meta", "health", "account"] },
] as const;
export function ManagementDashboard() {
  const [expanded, setExpanded] = useState(true),
    [source, setSource] = useState(""),
    [period, setPeriod] = useState("7");
  const [tab, setTab] = useState("overview"),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [start, setStart] = useState(day(-6)),
    [end, setEnd] = useState(day()),
    [status, setStatus] = useState(""),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [pixel, setPixel] = useState(""),
    [paused, setPaused] = useState(false),
    [saving, setSaving] = useState(false);
  const [linkSource, setLinkSource] = useState("meta"),
    [linkCampaign, setLinkCampaign] = useState(""),
    [linkMedium, setLinkMedium] = useState("paid_social"),
    [linkContent, setLinkContent] = useState("");
  const [site, setSite] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  useEffect(() => setSite(location.origin), []);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    setError("");
    const query = new URLSearchParams({
      start,
      end,
      source,
      status: tab === "orders" ? status : "",
      q: tab === "orders" ? search : "",
      page: String(page),
    });
    fetch("/api/admin/operations?" + query, {
      cache: "no-store",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        if (response.status === 401) {
          location.assign("/admin/entrar");
          return;
        }
        const d = (await response.json()) as Data & { error?: string };
        if (!response.ok)
          throw Error(d.error || "Não foi possível carregar os dados.");
        if (!abort.signal.aborted) {
          setData(d);
          if (!dirtyRef.current) {
            setPixel(d.settings.pixelId);
            setPaused(d.settings.capiPaused);
          }
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [start, end, status, search, page, revision, source, tab]);
  const current = nav.find((x) => x[0] === tab)!;
  const editPixel = (value: string) => { dirtyRef.current = true; setDirty(true); setPixel(value); };
  const editPaused = (value: boolean) => { dirtyRef.current = true; setDirty(true); setPaused(value); };
  async function savePixelSettings() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelId: pixel, capiPaused: paused }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw Error(result.error || "Falha ao salvar.");
      dirtyRef.current = false;
      setDirty(false);
      setNotice("Configuração salva com sucesso e registrada na auditoria.");
      setRevision(value => value + 1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const link =
    site +
    "/?" +
    new URLSearchParams({
      utm_source: linkSource,
      utm_medium: linkMedium,
      utm_campaign: linkCampaign,
      utm_content: linkContent,
    });
  function csv() {
    if (!data) return;
    const cell = (s: unknown) => {
      let text = String(s ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      ["Pedido", "Data", "Status", "Valor BRL"],
      ...data.orders.map((o) => [
        o.id,
        time(o.created_at),
        statuses[o.status] || o.status,
        (o.amount_cents / 100).toFixed(2),
      ]),
    ];
    const href = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = "pedidos-pagina-" + page + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <div className={`${styles.app} ${expanded ? styles.expanded : ""}`}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="/admin">
          <span>
            j<span>f</span>
          </span>
          <div>
            JotaFy<small>METATRACK · OPERAÇÕES</small>
          </div>
        </a>
        <button
          className={styles.collapse}
          aria-label={expanded ? "Recolher menu" : "Expandir menu"}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <div className={styles.navGroups}>
          {navGroups.map(group => (
            <div className={styles.navGroup} key={group.title}>
              <p className={styles.menuLabel}>{group.title}</p>
              <nav aria-label={group.title}>
                {group.keys.map(key => {
                  const item = nav.find(entry => entry[0] === key)!;
                  const [, label, Icon] = item;
                  return <button
                    key={key}
                    title={label}
                    aria-current={tab === key ? "page" : undefined}
                    onClick={() => { setTab(key); setNotice(""); }}
                  ><Icon size={18} aria-hidden="true"/><span>{label}</span></button>;
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className={styles.sideFoot}>
          <span className={styles.dot} />
          Receitas Premium<small>Workspace · Produção · BRL</small>
          <a href="/" target="_blank" rel="noreferrer">
            Abrir vitrine <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>Workspace</span><ChevronDown size={13}/><strong>JotaFy</strong><span className={styles.crumbDivider}>/</span><span>{current[1]}</span></div>
          <div className={styles.topbarRight}><span className={styles.livePill}><span className={styles.dot}/> Ambiente de produção</span>
          <button
            onClick={async () => {
              try {
                const r = await fetch("/api/admin/ebook/login", {
                  method: "DELETE",
                });
                if (!r.ok) throw Error("Não foi possível encerrar a sessão.");
                location.assign("/admin/entrar");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={16} /> Sair
          </button></div>
        </header>
        <main className={styles.main}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>JOTAFY / WORKSPACE</p>
              <h1>{current[1]}</h1>
              <p>{tab === "overview" ? "Acompanhe o desempenho real da sua operação." : tab === "product" ? "Catálogo, configurações e integrações do produto." : "Gerencie sua operação com dados verificados e rastreáveis."}</p>
            </div>
            <button
              className={styles.refresh}
              onClick={() => setRevision((v) => v + 1)}
              disabled={busy}
            >
              <RefreshCw size={16} />
              {busy ? "Atualizando…" : "Atualizar dados"}
            </button>
          </div>
          {error && (
            <div className={styles.error} role="alert">
              {error}{" "}
              <button onClick={() => setRevision((v) => v + 1)}>
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          )}
          {["overview", "orders", "operation"].includes(tab) && (
            <div className={tab === "overview" ? [styles.filters, styles.overviewFilters].join(" ") : styles.filters} aria-label="Filtros de período e tráfego">
              <div className={styles.filterTitle}><CalendarRange size={16}/><strong>Filtros do relatório</strong></div>
              <label>
                Período de visualização
                <select
                  aria-label="Período de visualização"
                  value={period}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPeriod(value);
                    if (value === "custom") return;
                    setStart(
                      value === "yesterday"
                        ? day(-1)
                        : day(-(Number(value) - 1)),
                    );
                    setEnd(value === "yesterday" ? day(-1) : day());
                    setPage(1);
                  }}
                >
                  <option value="1">Hoje</option>
                  <option value="yesterday">Ontem</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
              <label>
                Fonte de tráfego
                <select
                  aria-label="Fonte de tráfego"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas as fontes</option>
                  {(data?.sources || []).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {tab !== "overview" && <label>
                Conta de anúncio
                <select disabled aria-label="Conta de anúncio">
                  <option>Meta Ads não conectada</option>
                </select>
              </label>}
              {tab === "overview" ? (
                <details className={styles.dateDisclosure} open={period === "custom" ? true : undefined}>
                  <summary>Selecionar datas específicas</summary>
                  <div className={styles.dateDisclosureFields}>
              <label>
                De
                <input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setPeriod("custom");
                    setStart(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setPeriod("custom");
                    setEnd(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
                  </div>
                </details>
              ) : (
                <>
              <label>
                De
                <input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setPeriod("custom");
                    setStart(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setPeriod("custom");
                    setEnd(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
                </>
              )}
              <span className={styles.syncStatus} role="status">
                <CheckCircle2 size={14}/> Horário de Brasília
                {data && <small>Atualizado: {time(data.checkedAt)}</small>}
              </span>
            </div>
          )}
          {!data && !error && (
            <div className={styles.empty} role="status">
              {busy ? "Consultando sua operação…" : "Aguardando dados."}
            </div>
          )}
          {data && tab === "overview" && (
            <>
              <ExecutiveOverview
                data={data}
                onOrders={() => setTab("orders")}
                onCampaigns={() => setTab("operation")}
                onMeta={() => setTab("meta")}
                onProduct={() => setTab("product")}
              />
              <section className={[styles.panel, styles.recentOrders].join(" ")}>
                <div className={styles.sectionTitle}>
                  <div><h2>Últimos pedidos</h2><p>Pedidos do período selecionado. Status atualizado no servidor.</p></div>
                  <button className={styles.textButton} onClick={() => setTab("orders")}>Ver histórico <ArrowUpRight size={15}/></button>
                </div>
                {orderTable(data.orders.slice(0, 5))}
              </section>
            </>
          )}
          {data && tab === "orders" && (
            <section className={styles.panel}>
              <div className={styles.sectionTitle}>
                <div>
                  <h2>Histórico de pedidos</h2>
                  <p>
                    Filtro por criação do pedido. Status atual confirmado pelo
                    sistema.
                  </p>
                </div>
                <button onClick={csv} disabled={!data.orders.length}>
                  <Download size={16} />
                  Exportar página
                </button>
              </div>
              <div className={styles.orderFilters}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearch(q);
                    setPage(1);
                  }}
                >
                  <Search size={17} />
                  <input
                    aria-label="Identificador do pedido ou pagamento"
                    placeholder="Buscar ID de pedido ou pagamento"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button>Buscar</button>
                </form>
                <select
                  aria-label="Status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos os status</option>
                  {Object.entries(statuses).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              {orderTable(data.orders)}
              <div className={styles.pagination}>
                <button
                  disabled={page === 1 || busy}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>Página {page} · até 25 pedidos</span>
                <button
                  disabled={!data.hasMore || busy}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
              <p className={styles.muted}>
                Para consultar tentativas e emitir ou revogar acesso, abra
                Atendimento.
              </p>
            </section>
          )}
          {data && tab === "operation" && (
            <>
              <OperationSummary
                data={data}
                onOpenMeta={() => setTab("meta")}
                onOpenSources={() =>
                  document
                    .getElementById("campaign-sources")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              />
              <section className={styles.panel}>
                <div className={styles.sectionTitle}>
                  <div>
                    <h2 id="campaign-sources">Origens e campanhas</h2>
                    <p>
                      Origem da sessão de entrada e pedidos associados.
                      Atribuição interna; não equivale à atribuição da Meta.
                    </p>
                  </div>
                  <a
                    href="https://adsmanager.facebook.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir Meta Ads <ArrowUpRight size={15} />
                  </a>
                </div>
                <div className={styles.campaignToolbar}><label><Search size={16}/><span className={styles.srOnly}>Pesquisar campanha ou origem</span><input value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} placeholder="Filtrar campanhas na tabela"/></label><small>Até 100 origens retornadas · Atribuição interna</small></div>
                <div className={styles.tableScroll}>
                  <table>
                    <thead>
                      <tr>
                        <th>Campanha / origem</th>
                        <th>Sessões</th>
                        <th>Pedidos</th>
                        <th>Aprovados</th>
                        <th>Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.filter(c => `${c.campaign} ${c.source} ${c.medium}`.toLowerCase().includes(campaignFilter.trim().toLowerCase())).map((c, i) => (
                        <tr key={i}>
                          <td>
                            <strong>
                              {c.campaign || "Sem campanha informada"}
                            </strong>
                            <small>
                              {c.source} · {c.medium || "meio não informado"}
                            </small>
                          </td>
                          <td>{c.sessions}</td>
                          <td>{c.orders}</td>
                          <td>{c.approved || 0}</td>
                          <td>{money(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.campaigns.filter(c => `${c.campaign} ${c.source} ${c.medium}`.toLowerCase().includes(campaignFilter.trim().toLowerCase())).length && (
                    <p className={styles.empty}>{campaignFilter ? "Nenhuma campanha corresponde ao filtro." : "As origens aparecerão após as primeiras visitas rastreadas."}</p>
                  )}
                </div>
                <p className={styles.notice}>
                  Investimento, CPA, ROAS e edição de anúncios dependem de
                  acesso oficial à conta Meta Ads. Integração ainda não
                  configurada.
                </p>
              </section>
              <section className={styles.panel}>
                <h2>Crie um link rastreável</h2>
                <p>
                  Use este endereço nos anúncios para identificar origem e
                  campanha.
                </p>
                <div className={styles.formGrid}>
                  {[
                    ["Origem", linkSource, setLinkSource],
                    ["Meio", linkMedium, setLinkMedium],
                    ["Campanha", linkCampaign, setLinkCampaign],
                    ["Criativo", linkContent, setLinkContent],
                  ].map(([label, value, setter]) => (
                    <label key={String(label)}>
                      {String(label)}
                      <input
                        maxLength={160}
                        value={String(value)}
                        onChange={(e) =>
                          (setter as (s: string) => void)(e.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className={styles.copy}>
                  <input aria-label="Link com UTMs" readOnly value={link} />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        setNotice("Link copiado.");
                      } catch {
                        setError(
                          "Não foi possível copiar. Selecione e copie o link acima.",
                        );
                      }
                    }}
                  >
                    <Link2 size={16} />
                    Copiar link
                  </button>
                </div>
              </section>
            </>
          )}
          {data && tab === "health" && (
            <section className={styles.panel}>
              <h2>Saúde e observabilidade</h2>
              <p>
                Configuração não comprova disponibilidade externa. Filas abaixo
                são globais, sem filtro de período.
              </p>
              {[
                ["Banco de pedidos", "Consulta realizada com sucesso"],
                [
                  "Arquivo privado",
                  data.services.ebook === true
                    ? "Objeto localizado no armazenamento"
                    : data.services.ebook === false
                      ? "Arquivo não localizado"
                      : "Não foi possível consultar",
                ],
                [
                  "Mercado Pago",
                  data.services.paymentsConfigured
                    ? "Credencial e checkout habilitados; nenhuma cobrança de teste executada"
                    : "Configuração incompleta",
                ],
                [
                  "Meta CAPI",
                  data.settings.capiPaused
                    ? "Envio pausado pelo operador"
                    : data.services.metaConfigured
                      ? "Credencial e ativação presentes; confira respostas no diagnóstico"
                      : "Envio desabilitado ou sem credencial",
                ],
                [
                  "Rotina Meta",
                  data.health.find((h) => h.name === "meta_dispatch")
                    ? `${Date.now() - data.health.find((h) => h.name === "meta_dispatch")!.last_run > 15 * 60000 ? "Atenção: sem execução observada há mais de 15 minutos. " : ""}Última execução: ${time(data.health.find((h) => h.name === "meta_dispatch")!.last_run)}`
                    : "Ainda sem observação. Não é possível confirmar execução.",
                ],
              ].map(([label, value]) => (
                <div className={styles.healthRow} key={label}>
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              ))}
              <h3>Fila Meta</h3>
              {data.meta?.length ? (
                data.meta.map((x) => (
                  <p key={x.state}>
                    {x.state}: {x.total} · maior número de tentativas:{" "}
                    {x.max_attempts}
                    {x.max_attempts >= 12
                      ? " · requer conferência no diagnóstico"
                      : ""}
                  </p>
                ))
              ) : (
                <p>Sem registros de envio disponíveis.</p>
              )}
              <h3>Notificações do aplicativo</h3>
              {data.push?.length ? (
                data.push.map((x) => (
                  <p key={x.status}>
                    {x.status}: {x.total}
                  </p>
                ))
              ) : (
                <p>
                  Sem registros de fila disponíveis. Isso não comprova entrega
                  ao aparelho.
                </p>
              )}
              <button onClick={() => setTab("meta")}>
                Abrir diagnóstico da Meta
              </button>
            </section>
          )}
          {data && tab === "product" && (
            <ProductWorkspace
              product={data.product}
              settings={data.settings}
              pixel={pixel}
              paused={paused}
              dirty={dirty}
              saving={saving}
              onPixelChange={editPixel}
              onPausedChange={editPaused}
              onSave={savePixelSettings}
              onOpenSupport={() => setTab("support")}
            />
          )}
          {tab === "account" && <OperatorAccount />}
          {tab === "support" && (
            <div className={styles.embedded}>
              <AccessAdminScreen />
            </div>
          )}
          {tab === "meta" && (
            <div className={styles.embedded}>
              <MetaDiagnosticsScreen />
            </div>
          )}
          <footer className={styles.footer}>
            JotaFy · Central de operação{" "}
            <span>Valores em reais · Horários de Brasília</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function orderTable(orders: Order[]) {
  return (
    <div className={styles.tableScroll}>
      <table>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Criado em · Brasília</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <code>{o.id}</code>
              </td>
              <td>{time(o.created_at)}</td>
              <td>
                <span
                  className={
                    o.status === "approved" ? styles.approved : styles.badge
                  }
                >
                  {statuses[o.status] || o.status}
                </span>
              </td>
              <td>
                <strong>{money(o.amount_cents)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && (
        <p className={styles.empty}>
          Nenhum pedido encontrado para estes filtros.
        </p>
      )}
    </div>
  );
}
