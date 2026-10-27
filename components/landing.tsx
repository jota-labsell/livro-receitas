"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EbookManifest } from "@/lib/ebook";
import { ProductPreviewVideo } from "./ProductPreviewVideo";
import { Checkout } from "./checkout";
import { track } from "@/lib/analytics";
const CTA = ({
  location = "offer",
  children = "QUERO AS 150 RECEITAS POR R$ 10",
}: {
  location?: string;
  children?: React.ReactNode;
}) => (
  <a
    href="#checkout"
    className="button"
    data-location={location}
    onClick={() => track("cta_click")}
  >
    {children}
  </a>
);
export function HeroSection({ ebook }: { ebook: EbookManifest | null }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let sent = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !sent) {
          track("offer_view");
          sent = true;
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="hero" id="oferta" ref={root}>
      <div className="curve curve-top" aria-hidden="true" />
      <div className="wrap hero-content">
        <p className="edition-label">150 DOCES PARA COMER E VENDER</p>
        <h1>
          Os doces que <span className="purple">chamam atenção nas redes</span>{" "}
          podem entrar no <span className="magenta">seu cardápio.</span>
        </h1>
        <p className="hero-lead">
          Tenha 150 receitas para preparar em casa, testar novos sabores e
          começar a montar sua oferta de doces.
        </p>
        <ProductPreviewVideo ebook={ebook ?? undefined} />
        <p className="product-facts">
          150 receitas <span>•</span> 10 capítulos <span>•</span> 167 páginas
        </p>
        <p className="edition">Edição fotográfica em PDF</p>
        <div className="initial-offer" id="oferta-inicial">
          <h2>
            Seu livro de receitas por <strong>R$ 10</strong>
          </h2>
          <p>Pagamento único. Sem assinatura.</p>
          <CTA />
          <p className="delivery">
            Baixe o PDF após a confirmação do pagamento.
          </p>
        </div>
      </div>
    </section>
  );
}
const samples = [
  {
    index: 2,
    title: "Brigadeiro belga intenso",
    category: "BRIGADEIROS GOURMET",
  },
  {
    index: 3,
    title: "Cookie recheado de chocolate cremoso",
    category: "COOKIES RECHEADOS",
  },
  {
    index: 5,
    title: "Copo da felicidade Ninho com morango",
    category: "COPOS DA FELICIDADE",
  },
];
export function InsideEbookGallery({ ebook }: { ebook: EbookManifest | null }) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const show = (i: number, button: HTMLButtonElement) => {
    setIndex(i);
    trigger.current = button;
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  const move = (n: number) =>
    setIndex((i) => (i + n + samples.length) % samples.length);
  return (
    <section className="proof wrap" id="por-dentro">
      <p className="section-label">ABRA. ESCOLHA. PREPARE.</p>
      <h2>
        Veja o que você leva
        <br className="desktop-break" /> para a sua cozinha.
      </h2>
      <p className="gallery-help">
        Três receitas do livro. Toque em uma página para ampliar.
      </p>
      <div
        className="sample-gallery"
        aria-label="Páginas reais de três categorias"
      >
        {ebook &&
          samples.map((sample, i) => (
            <button
              className="sample"
              key={sample.index}
              onClick={(e) => show(i, e.currentTarget)}
              aria-label={`Ampliar receita: ${sample.title}`}
            >
              <span className="sample-paper">
                <Image
                  src={ebook.images[sample.index]}
                  alt={`Página real de ${sample.title}, com foto, ingredientes e modo de preparo`}
                  width={400}
                  height={566}
                  sizes="(max-width: 600px) 77vw, 280px"
                />
                <span className="expand" aria-hidden="true">
                  ＋
                </span>
              </span>
              <span className="sample-category">{sample.category}</span>
              <span className="sample-title">{sample.title}</span>
            </button>
          ))}
      </div>
      <div className="three-reasons">
        <article>
          <span className="reason-number">01</span>
          <h3>Escolha o que preparar</h3>
          <p>
            Dos brigadeiros e brownies aos cookies recheados e doces no pote.
          </p>
        </article>
        <article>
          <span className="reason-number">02</span>
          <h3>Acompanhe o passo a passo</h3>
          <p>Ingredientes e instruções de preparo organizados para consulta.</p>
        </article>
        <article>
          <span className="reason-number">03</span>
          <h3>Teste suas primeiras opções de venda</h3>
          <p>
            Dicas de apresentação e precificação para ajudar a planejar seus
            produtos.
          </p>
        </article>
      </div>
      <div className="proof-cta">
        <CTA location="proof" />
        <p className="photo-note">
          As fotografias do livro são referências das preparações; o resultado
          depende da execução.
        </p>
      </div>
      {ebook && (
        <dialog
          ref={dialog}
          className="gallery-modal"
          aria-label="Página ampliada do livro"
          onCancel={close}
          onClose={() => trigger.current?.focus()}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") move(-1);
            if (e.key === "ArrowRight") move(1);
          }}
          onClick={(e) => {
            if (e.target === dialog.current) close();
          }}
        >
          <div className="modal-toolbar">
            <p>
              {samples[index].category} · {index + 1}/3
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar página ampliada"
            >
              ✕
            </button>
          </div>
          <div className="modal-image">
            <Image
              src={ebook.images[samples[index].index]}
              alt={`Receita completa: ${samples[index].title}`}
              width={778}
              height={1100}
            />
          </div>
          <div className="modal-controls">
            <button type="button" onClick={() => move(-1)}>
              ← Anterior
            </button>
            <span>Arraste a página para ler</span>
            <button type="button" onClick={() => move(1)}>
              Próxima →
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
export function OfferSection() {
  return (
    <section className="checkout-section" id="checkout">
      <div className="curve curve-checkout" aria-hidden="true" />
      <div className="wrap">
        <p className="section-label">SEU PRÓXIMO DOCE COMEÇA AQUI</p>
        <h2>
          Leve as 150 receitas
          <br />
          por <span className="magenta">R$ 10.</span>
        </h2>
        <div className="order-summary">
          <div>
            <h3>150 Doces para Comer e Vender</h3>
            <p>Edição fotográfica em PDF</p>
            <p>150 receitas, 10 capítulos e 167 páginas</p>
          </div>
          <div className="summary-price">
            <strong>R$ 10,00</strong>
            <span>Pagamento único</span>
          </div>
        </div>
        <Checkout />
        <FAQSection />
      </div>
    </section>
  );
}
const faqs = [
  ["Como recebo?", "Download do PDF após a aprovação do pagamento."],
  [
    "Preciso ter experiência?",
    "O material apresenta ingredientes e preparo; algumas receitas podem exigir prática.",
  ],
  ["Existe mensalidade?", "Não. A compra é de R$ 10,00 em pagamento único."],
];
export function FAQSection() {
  return (
    <div className="faq" aria-label="Dúvidas sobre a compra">
      {faqs.map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <span aria-hidden="true">＋</span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
export function Footer() {
  return (
    <footer className="wrap">
      <span>150 Doces para Comer e Vender</span>
      <div>
        <Link href="/privacidade">Privacidade</Link>
        <Link href="/termos">Termos</Link>
        <a href="mailto:receitaspremium150@gmail.com">
          receitaspremium150@gmail.com
        </a>
      </div>
    </footer>
  );
}
export function MobileCTA() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const update = () => {
      const offer = document.getElementById("oferta-inicial"),
        checkout = document.getElementById("checkout");
      if (!offer || !checkout) return;
      const bounds = checkout.getBoundingClientRect();
      setShow(
        offer.getBoundingClientRect().bottom < 0 &&
          (bounds.top >= innerHeight || bounds.bottom <= 0),
      );
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
    };
  }, []);
  return show ? (
    <div className="mobile-cta">
      <CTA location="sticky">150 RECEITAS · R$ 10</CTA>
    </div>
  ) : null;
}
