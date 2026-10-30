"use client";
import { metaConfirmedPurchase, type ConfirmedPurchase } from "@/lib/meta-pixel";
import { useCallback, useEffect, useRef, useState } from "react";
import { visitId, track } from "@/lib/analytics";
import { Check, Copy, CreditCard, LockKeyhole, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./checkout.module.css";
import { usePurchaseState } from "./purchase-experience";
import { metaAttribution } from "@/lib/meta-attribution-client";
type Controller = { unmount: () => Promise<void> };
type Bricks = {
  create: (
    type: string,
    id: string,
    settings: Record<string, unknown>,
  ) => Promise<Controller>;
};
declare global {
  interface Window {
    receitasPaymentSdk?: { publicKey: string; builder: Bricks };
    MercadoPago?: new (
      key: string,
      settings: Record<string, string>,
    ) => { bricks: () => Bricks };
  }
}
type Config = {
  available: boolean;
  publicKey?: string;
  amount?: number;
  paymentMethods?: Record<string, unknown>;
  mode?: string;
};
type Result = { status: string; paymentId?: string | null; pix?: { code: string; qrCodeBase64?: string }; expired?: boolean; purchase?: ConfirmedPurchase };
let sdkPromise: Promise<void> | undefined;
export function loadSdk() {
  if (window.MercadoPago) return Promise.resolve();
  if (!sdkPromise)
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.mercadopago.com/js/v2";
      script.async = true;
      script.onload = () => {
        if (window.MercadoPago) resolve();
        else { sdkPromise = undefined; reject(new Error("O SDK de pagamento não foi inicializado.")); }
      };
      script.onerror = () => {
        sdkPromise = undefined;
        script.remove();
        reject(
          new Error("Não foi possível carregar o pagamento. Tente novamente."),
        );
      };
      document.head.appendChild(script);
    });
  return sdkPromise;
}
export function getBricks(publicKey: string) {
  if (window.receitasPaymentSdk) {
    if (window.receitasPaymentSdk.publicKey !== publicKey)
      throw new Error("A configuração de pagamento mudou. Recarregue a página.");
    return window.receitasPaymentSdk.builder;
  }
  const builder = new window.MercadoPago!(publicKey, { locale: "pt-BR" }).bricks();
  window.receitasPaymentSdk = { publicKey, builder };
  return builder;
}
async function post(path: string, data?: unknown): Promise<Result> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify({ ...data, meta: metaAttribution() }) : undefined,
  });
  const result = (await response.json()) as Result & { error?: string };
  if (!response.ok)
    throw new Error(result.error || "Não foi possível consultar seu pedido.");
  return result;
}
export function Checkout() {
  const reportPurchaseState = usePurchaseState();
  const [method, setMethod] = useState("card");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const pixCode = useRef<HTMLTextAreaElement>(null);
  const [config, setConfig] = useState<Config | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    sending = useRef(false),
    lifecycle = useRef<Promise<void>>(Promise.resolve()),
    seen = useRef(false);
  const refresh = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      setResult(await post("/api/orders/status"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seen.current) {
          seen.current = true;
          track("checkout_start");
          void initialize();
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    async function initialize() {
      try {
        const response = await fetch("/api/checkout");
        const c = (await response.json()) as Config;
        if (cancelled) return;
        setConfig(c);
        if (!c.paymentMethods?.creditCard) setMethod("pix");
        if (c.available) {
          if (!c.publicKey || !Number.isFinite(c.amount) || (c.amount ?? 0) <= 0) {
            throw new Error("Configuração de pagamento incompleta. Entre em contato com o suporte.");
          }
          await post("/api/checkout", { visitId: visitId() });
          const previous = await post("/api/orders/status");
          if (!cancelled && previous.status !== "created") setResult(previous);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (root.current) observer.observe(root.current);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);
  const status = result?.status;
  useEffect(() => {
    if (result) reportPurchaseState(result);
  }, [result, reportPurchaseState]);
  useEffect(() => {
    if (status === "approved" && result?.purchase) metaConfirmedPurchase(result.purchase);
  }, [status, result?.purchase]);
  useEffect(() => {
    if (!config?.available || loading || method !== "card" || (status && status !== "created")) return;
    let disposed = false;
    let mounted: Controller | undefined;
    const previous = lifecycle.current;
    async function mount() {
      try {
        await previous;
        if (disposed) return;
        await loadSdk();
        if (disposed) return;
        const theme = getComputedStyle(root.current!);
        const color = (name: string, fallback: string) => theme.getPropertyValue(name).trim() || fallback;
        const instance = await getBricks(config!.publicKey!).create(
          "payment", "payment-brick", {
                initialization: { amount: config!.amount },
                customization: {
                  paymentMethods: { creditCard: config!.paymentMethods?.creditCard, maxInstallments: 1 },
                  visual: {
                    hideFormTitle: true,
                    defaultPaymentOption: { creditCardForm: true },
                    texts: {
                      formSubmit: "Pagar com cartão",
                      cardholderName: { label: "Nome completo do titular", placeholder: "Como está escrito no cartão" },
                      installmentsSectionTitle: "Condições de pagamento",
                    },
                    style: {
                      theme: "default",
                      customVariables: {
                        baseColor: color("--checkout-primary", "#166534"),
                        baseColorFirstVariant: color("--checkout-hover", "#14532d"),
                        baseColorSecondVariant: color("--checkout-selected", "#eaf6ee"),
                        textPrimaryColor: color("--checkout-text", "#172d20"),
                        textSecondaryColor: color("--checkout-secondary", "#526459"),
                        buttonTextColor: "#ffffff",
                        outlinePrimaryColor: "#6b8173",
                        inputBackgroundColor: "#ffffff",
                        formBackgroundColor: "#ffffff",
                        inputFocusedBoxShadow: "0 0 0 3px #bbf7d0",
                        inputVerticalPadding: "16px",
                        inputHorizontalPadding: "16px",
                        borderRadiusMedium: "9px",
                        formPadding: "16px",
                        fontSizeMedium: "16px",
                        fontSizeLarge: "18px",
                        fontSizeExtraLarge: "20px",
                      },
                    },
                  },
                },
                callbacks: {
                  onReady: () => {},
                  onError: () =>
                    setError(
                      "Confira os dados de pagamento. Se necessário, tente carregar novamente.",
                    ),
                  onSubmit: async ({ formData }: { formData: unknown }) => {
                    if (sending.current)
                      throw new Error("Pagamento em processamento.");
                    sending.current = true;
                    setBusy(true);
                    setError("");
                    try {
                      const payment = await post("/api/payments", {
                        visitId: visitId(),
                        formData,
                      });
                      setResult(payment);
                    } catch (e) {
                      setError((e as Error).message);
                      // A resposta pode ter sido perdida após o provedor receber a tentativa.
                      // Confirmar o estado antes de permitir qualquer nova cobrança.
                      try {
                        setResult(await post("/api/orders/status"));
                      } catch {
                        setResult({ status: "processing" });
                      }
                      throw e;
                    } finally {
                      sending.current = false;
                      setBusy(false);
                    }
                  },
                },
              },
        );
        mounted = instance;
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    }
    lifecycle.current = mount();
    return () => {
      disposed = true;
      // Finish an in-flight creation and its teardown before mounting another Brick.
      lifecycle.current = lifecycle.current.then(async () => { await mounted?.unmount(); });
      void lifecycle.current.catch(() => {});
    };
  }, [config, loading, retry, status, result?.paymentId, method]);
  useEffect(() => {
    if (status !== "pending" && status !== "processing") return;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    return () => window.clearInterval(timer);
  }, [status, refresh]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copyPix() {
    setCopyError("");
    setCopied(false);
    try {
      await navigator.clipboard.writeText(result!.pix!.code);
      setCopied(true);
    } catch {
      pixCode.current?.focus();
      pixCode.current?.select();
      setCopyError("Não foi possível copiar automaticamente. O código está selecionado: copie e cole no aplicativo do seu banco.");
    }
  }
  async function submitPix() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      setResult(await post("/api/payments", { visitId: visitId(), formData: { payment_method_id: "pix", payer: { email: email.trim() } } }));
    } catch (e) {
      setError((e as Error).message);
      try { setResult(await post("/api/orders/status")); }
      catch { setResult({ status: "processing" }); }
    } finally { sending.current = false; setBusy(false); }
  }
  const again = () => {
    setError("");
    setResult(null);
    setRetry((n) => n + 1);
  };
  return (
    <div className={`payment-area ${styles.panel}`} ref={root} aria-busy={busy || loading}>
      <div className={`payment-heading ${styles.heading}`}>
        <span className={styles.badge}><LockKeyhole size={16} aria-hidden="true" /> Ambiente seguro</span>
        <h3>Conclua sua compra</h3>
      </div>
      <p className={`checkout-caption ${styles.caption}`}>Preencha seus dados e finalize a compra com segurança.</p>
      {loading && (
        <p className={`payment-notice ${styles.notice}`} role="status">
          Carregando o pagamento…
        </p>
      )}
      {!loading && !config?.available && (
        <div className={`payment-notice ${styles.notice}`} role="status">
          <p>O pagamento está temporariamente indisponível.</p>
          <p>
            Tente novamente em instantes ou{" "}
            <a href="mailto:receitaspremium150@gmail.com">entre em contato</a>.
          </p>
        </div>
      )}
      {config?.available && (
        <>
          {(!status || status === "created") && !loading && (
            <div className={`checkout-fields ${styles.fields}`}>
              <fieldset disabled={busy} className={`payment-methods ${styles.methods}`}>
                <legend>Forma de pagamento</legend>
                {!!config.paymentMethods?.creditCard && <label className={styles.method}>
                  <input type="radio" name="payment-method" aria-label="Cartão de crédito" checked={method === "card"} onChange={() => setMethod("card")} />
                  <CreditCard size={22} aria-hidden="true" />
                  <span className={styles.methodCopy}><strong>Cartão de crédito</strong><small>À vista, sem assinatura</small></span>
                </label>}
                {!!config.paymentMethods?.bankTransfer && <label className={styles.method}>
                  <input type="radio" name="payment-method" aria-label="Pix" checked={method === "pix"} onChange={() => setMethod("pix")} />
                  <QrCode size={22} aria-hidden="true" />
                  <span className={styles.methodCopy}><strong>Pix</strong><small>QR Code ou copia e cola</small></span>
                </label>}
              </fieldset>
              {method === "pix" && <form className={`pix-form ${styles.form}`} onSubmit={(event) => { event.preventDefault(); void submitPix(); }}>
                <h4>Dados do comprador</h4>
                <p>Informe seu e-mail para identificar esta compra.</p>
                <label htmlFor="pix-email">E-mail</label>
                <input id="pix-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} aria-describedby="pix-help" />
                <p id="pix-help">O QR Code e o código Pix aparecerão aqui após gerar o pagamento.</p>
                <button className={`button ${styles.primary}`} type="submit" disabled={busy}>
                  <QrCode size={19} aria-hidden="true" />{busy ? "Gerando Pix…" : "Gerar Pix de R$ 10,00"}
                </button>
              </form>}
            </div>
          )}
          {busy && (
            <p role="status" className={`payment-notice ${styles.notice}`}>
              Processando sua solicitação. Aguarde a confirmação.
            </p>
          )}
          {status === "approved" ? (
            null
          ) : status === "refunded" || status === "charged_back" ? (
            <p role="status" className={`payment-notice ${styles.notice}`}>
              Este pagamento foi estornado ou contestado. O download está
              indisponível. Entre em contato para conferir o pedido.
            </p>
          ) : (
            <>
              {(status === "rejected" || status === "cancelled") && (
                <div role="status" className={`payment-notice ${styles.notice}`}>
                  <p>
                    {result?.expired ? "O Pix expirou. Gere um novo pagamento ou escolha" : "O pagamento não foi aprovado. Confira os dados ou tente"}
                    outro meio de pagamento.
                  </p>
                  <button type="button" className={`text-button ${styles.retry}`} onClick={again}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {(status === "pending" || status === "processing") && (
                <div role="status" className={`payment-notice ${styles.notice}`}>
                  <p>
                    {status === "pending"
                      ? "Seu pagamento aguarda confirmação."
                      : "Estamos confirmando se o pagamento foi recebido."}
                  </p>
                  <p>
                    O download será liberado após a aprovação. Consulte o status
                    antes de tentar outra compra.
                  </p>
                </div>
              )}
              <section className={styles.cardSection} hidden={method !== "card" || !!status && status !== "created"} aria-labelledby="card-data-title">
                <h4 id="card-data-title">Dados do comprador e do cartão</h4>
                <p>Preencha os campos abaixo. O pagamento é processado pelo Mercado Pago.</p>
                <div
                className={busy ? "brick-blocked" : ""}
                inert={busy}
                hidden={
                  method !== "card" || !!status && status !== "created"
                }
                id="payment-brick"
              />
              </section>
              {status === "pending" && result?.pix?.code && (
                <section className={styles.pixPanel} aria-labelledby="pix-title">
                  <h4 id="pix-title">Seu Pix está pronto</h4>
                  <p id="pix-instructions">Escaneie o QR Code no app do seu banco ou copie o código abaixo.</p>
                  {result.pix.qrCodeBase64 && <div className={styles.qrFrame}><img className={`pix-qr ${styles.qrImage}`} src={`data:image/png;base64,${result.pix.qrCodeBase64}`} alt="QR Code Pix do seu pedido" /></div>}
                  <div>
                    <label htmlFor="pix-code">Pix copia e cola</label>
                    <textarea ref={pixCode} className={styles.pixCode} id="pix-code" rows={3} readOnly value={result.pix.code} aria-describedby="pix-instructions" />
                  </div>
                  <button type="button" className={styles.secondary} onClick={() => void copyPix()} aria-label="Copiar código Pix (copia e cola)">
                    {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
                    {copied ? "Copiado!" : "Copiar código Pix (copia e cola)"}
                  </button>
                  <p className={styles.copyStatus} role="status" aria-live="polite" aria-atomic="true">{copied ? "Copiado! Cole o código no aplicativo do seu banco." : ""}</p>
                  {copyError && <p className={styles.copyError} role="alert">{copyError}</p>}
                </section>
              )}
              {status && status !== "created" && (
              <button
                type="button"
                className={`status-button ${styles.secondary}`}
                disabled={busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={18} aria-hidden="true" />
                {busy ? "Consultando…" : "Consultar status do pagamento"}
              </button>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className={`payment-error ${styles.error}`}>
          {error}
        </p>
      )}
      {config?.available && error && !status && (
        <button
          type="button"
          className={`text-button ${styles.retry}`}
          onClick={() => setRetry((n) => n + 1)}
        >
          Carregar pagamento novamente
        </button>
      )}
      <p className={styles.trust}><ShieldCheck size={18} aria-hidden="true" /> Dados de pagamento processados pelo Mercado Pago.</p>
      <p className={`small delivery-note ${styles.delivery}`}>
        Baixe o PDF nesta página após a confirmação do pagamento. Mantenha este
        navegador para consultar sua compra.
      </p>
    </div>
  );
}
