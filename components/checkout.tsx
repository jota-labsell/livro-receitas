"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { visitId, track } from "@/lib/analytics";
import { LockKeyhole, ShieldCheck, CheckCircle2 } from "lucide-react";
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
type Result = { status: string; paymentId?: string | null; pix?: { code: string } };
let sdkPromise: Promise<void> | undefined;
function loadSdk() {
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
async function post(path: string, data?: unknown): Promise<Result> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as Result & { error?: string };
  if (!response.ok)
    throw new Error(result.error || "Não foi possível consultar seu pedido.");
  return result;
}
export function Checkout() {
  const [config, setConfig] = useState<Config | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [brickReady, setBrickReady] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    sending = useRef(false),
    builder = useRef<Bricks | null>(null),
    controller = useRef<Controller | null>(null),
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
    async function initialize() {
      try {
        const response = await fetch("/api/checkout", { cache: "no-store" });
        const c = (await response.json()) as Config;
        if (cancelled) return;
        setConfig(c);
        if (c.available) {
          if (!c.publicKey || !Number.isFinite(c.amount) || (c.amount ?? 0) <= 0) {
            throw new Error("Configuração de pagamento incompleta. Entre em contato com o suporte.");
          }
          // Download the official SDK in parallel with the order/session round trips.
          // This never charges the customer; charging still requires onSubmit.
          const sdk = loadSdk();
          await post("/api/checkout", { visitId: visitId() });
          const previous = await post("/api/orders/status");
          if (!cancelled && previous.status !== "created") setResult(previous);
          await sdk;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !seen.current) {
        seen.current = true;
        track("checkout_start");
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const status = result?.status;
  useEffect(() => {
    if (!config?.available || loading) return;
    let disposed = false;
    async function mount() {
      setBrickReady(false);
      try {
        await loadSdk();
        if (disposed) return;
        builder.current = new window.MercadoPago!(config!.publicKey!, {
          locale: "pt-BR",
        }).bricks();
        if (
          status === "approved" ||
          status === "refunded" ||
          status === "charged_back"
        )
          return;
        if (
          (status === "pending" || status === "processing") &&
          !result?.paymentId
        )
          return;
        const pending = status === "pending" || status === "processing";
        const instance = await builder.current.create(
          pending ? "statusScreen" : "payment",
          pending ? "status-screen" : "payment-brick",
          pending
            ? {
                initialization: { paymentId: result!.paymentId },
                callbacks: {
                  onReady: () => setBrickReady(true),
                  onError: () =>
                    setError(
                      "Consulte o status abaixo para acompanhar seu pagamento.",
                    ),
                },
              }
            : {
                initialization: { amount: config!.amount },
                customization: {
                  paymentMethods: config!.paymentMethods,
                  visual: {
                    defaultPaymentOption: config!.paymentMethods?.creditCard
                      ? { creditCardForm: true }
                      : config!.paymentMethods?.bankTransfer
                        ? { bankTransferForm: true }
                        : { debitCardForm: true },
                    texts: {
                      formTitle: "Preencha os dados do cartão",
                      // When Pix is also available, let the SDK pick the contextual action label.
                      ...(config!.paymentMethods?.bankTransfer ? {} : { formSubmit: "Pagar com cartão" }),
                      cardholderName: {
                        label: "Nome completo do titular",
                        placeholder: "Como está escrito no cartão",
                      },
                      installmentsSectionTitle: "Condições de pagamento",
                      paymentMethods: {
                        creditCardTitle: "Cartão de crédito",
                        debitCardTitle: "Cartão de débito",
                      },
                    },
                    style: {
                      theme: "default",
                      customVariables: {
                        baseColor: "#ab167c",
                        baseColorFirstVariant: "#961368",
                        baseColorSecondVariant: "#fceaf5",
                        textPrimaryColor: "#282037",
                        textSecondaryColor: "#645a6b",
                        buttonTextColor: "#ffffff",
                        inputBackgroundColor: "#ffffff",
                        formBackgroundColor: "#ffffff",
                        outlinePrimaryColor: "#d5c9d9",
                        outlineSecondaryColor: "#e8e0eb",
                        successColor: "#20804d",
                        borderRadiusSmall: "8px",
                        borderRadiusMedium: "14px",
                        borderRadiusLarge: "18px",
                        inputVerticalPadding: "16px",
                        inputHorizontalPadding: "16px",
                        inputBorderWidth: "1px",
                        inputFocusedBorderWidth: "2px",
                        formPadding: "0px",
                        fontSizeSmall: "13px",
                        fontSizeMedium: "15px",
                        fontSizeLarge: "17px",
                        fontSizeExtraLarge: "19px",
                      },
                    },
                  },
                },
                callbacks: {
                  onReady: () => setBrickReady(true),
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
        if (disposed) await instance.unmount();
        else controller.current = instance;
      } catch (e) {
        if (!disposed) setError((e as Error).message);
      }
    }
    void mount();
    return () => {
      disposed = true;
      void controller.current?.unmount();
      controller.current = null;
    };
  }, [config, loading, retry, status, result?.paymentId]);
  const again = () => {
    setError("");
    setResult(null);
    setRetry((n) => n + 1);
  };
  return (
    <div className="payment-area" ref={root} aria-busy={busy || loading}>
      <div className="checkout-secure-banner">
        <span className="checkout-secure-icon"><LockKeyhole size={22} aria-hidden="true" /></span>
        <span><strong>Você está na etapa de pagamento</strong><small>Finalize sua compra aqui, com o Mercado Pago.</small></span>
        <ShieldCheck className="checkout-secure-shield" size={26} aria-hidden="true" />
      </div>
      <div className="payment-heading">
        <h3>Escolha como pagar</h3>
        <span>R$ 10,00</span>
      </div>
      <p className="checkout-caption">Pagamento único de R$ 10,00. Sem assinatura.</p>
      <div className="checkout-progress"><span className="checkout-progress-done"><CheckCircle2 size={16} aria-hidden="true" /> Pedido</span><span className="checkout-progress-current">2. Pagamento</span><span>3. Download</span></div>
      {loading && (
        <div className="checkout-loading" role="status" aria-live="polite">
          <span className="checkout-spinner" aria-hidden="true" />
          <div><strong>Preparando seu pagamento...</strong><p>Carregando os meios de pagamento disponíveis.</p></div>
        </div>
      )}
      {!loading && !config?.available && (
        <div className="payment-notice" role="status">
          <p>O pagamento está temporariamente indisponível.</p>
          <p>
            Tente novamente em instantes ou{" "}
            <a href="mailto:receitaspremium150@gmail.com">entre em contato</a>.
          </p>
        </div>
      )}
      {config?.available && (
        <>
          {busy && (
            <p role="status" className="payment-notice">
              Processando sua solicitação. Aguarde a confirmação.
            </p>
          )}
          {status === "approved" ? (
            <div className="approved" role="status">
              <h3>Pagamento aprovado!</h3>
              <p>Seu livro já pode ir para a cozinha.</p>
              <a href="/api/download" className="button">
                BAIXAR AS 150 RECEITAS
              </a>
              <p className="small">O download é autorizado ao abrir o link.</p>
            </div>
          ) : status === "refunded" || status === "charged_back" ? (
            <p role="status" className="payment-notice">
              Este pagamento foi estornado ou contestado. O download está
              indisponível. Entre em contato para conferir o pedido.
            </p>
          ) : (
            <>
              {(status === "rejected" || status === "cancelled") && (
                <div role="status" className="payment-notice">
                  <p>
                    O pagamento não foi aprovado. Confira os dados ou tente
                    outro meio de pagamento.
                  </p>
                  <button type="button" className="text-button" onClick={again}>
                    Tentar novamente
                  </button>
                </div>
              )}
              {(status === "pending" || status === "processing") && (
                <div role="status" className="payment-notice">
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
              {(!brickReady && !status) && (
                <div className="checkout-loading" role="status">
                  <span className="checkout-spinner" aria-hidden="true" />
                  <div><strong>Abrindo formulário de pagamento...</strong><p>Você poderá preencher os dados aqui mesmo.</p></div>
                </div>
              )}
              <div
                className={busy ? "brick-blocked" : ""}
                inert={busy}
                hidden={
                  status === "pending" ||
                  status === "processing" ||
                  status === "rejected" ||
                  status === "cancelled"
                }
                id="payment-brick"
              />
              {status === "pending" && result?.pix?.code && (
                <div className="payment-notice">
                  <label htmlFor="pix-code">Pix copia e cola</label>
                  <textarea id="pix-code" readOnly value={result.pix.code} style={{ width: "100%", minHeight: 90 }} />
                  <p>Copie o código e pague no aplicativo do seu banco. Depois consulte o status.</p>
                </div>
              )}
              <div
                id="status-screen"
                hidden={status !== "pending" && status !== "processing"}
              />
              <button
                type="button"
                className="status-button"
                disabled={busy}
                onClick={() => void refresh()}
              >
                {busy ? "Consultando…" : "Consultar status do pagamento"}
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="payment-error">
          {error}
        </p>
      )}
      {config?.available && error && !status && (
        <button
          type="button"
          className="text-button"
          onClick={() => setRetry((n) => n + 1)}
        >
          Carregar pagamento novamente
        </button>
      )}
      <div className="checkout-trust-footer"><LockKeyhole size={15} aria-hidden="true" /><span>Dados do pagamento tratados pelo Mercado Pago. Acesso ao PDF após aprovação.</span></div>
      <p className="small delivery-note">
        Baixe o PDF nesta página após a confirmação do pagamento. Mantenha este
        navegador para consultar sua compra.
      </p>
    </div>
  );
}
