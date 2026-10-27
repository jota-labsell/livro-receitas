"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EbookManifest } from "@/lib/ebook-preview";
import { ProductPreviewGif } from "./ProductPreviewGif";
import {
  CheckCircle2,
  Camera,
  ShieldCheck,
  CreditCard,
  Download,
} from "lucide-react";
import { PURCHASE_TERMS } from "@/lib/purchase-terms";
import { Checkout } from "./checkout";
import { track } from "@/lib/analytics";
const CTA = ({
  location = "offer",
  children = "SIM, QUERO MINHAS 150 RECEITAS!",
}: {
  location?: string;
  children?: React.ReactNode;
}) => (
  <a href="#checkout" className="button conversion-cta" data-location={location} onClick={() => track("cta_click")}>
    <span className="cta-shine-text">{children}</span>
    <span className="cta-arrow" aria-hidden="true">→</span>
  </a>
);
export function HeroSection() {
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
      <div className="social-corner" aria-label="Receitas inspiradas nas tendências do Instagram e TikTok">
        <Camera size={22} aria-hidden="true" />
        <span className="social-tiktok" aria-hidden="true">♪</span>
      </div>
      <div className="wrap hero-content">
        <p className="edition-label">
          150 DOCES PARA COMER E VENDER · PDF POR R$ 10
        </p>
        <h1>
          <span className="headline-first">Descubra <span className="headline-count">150 receitas de doces</span></span>
          <span className="headline-description">inspiradas nas tendências do <span className="purple">Instagram</span> e <span className="magenta">TikTok</span></span>
          <span className="headline-outcome">e comece a criar sua renda extra!</span>
        </h1>
        <p className="hero-lead">Receitas com fotos e passo a passo para você preparar doces deliciosos, testar seu cardápio e começar a vender — mesmo que esteja dando os primeiros passos.</p>
        <ProductPreviewGif />
        <div className="hero-buy">
          <p className="hero-buy-kicker">150 RECEITAS • 167 PÁGINAS • DOWNLOAD EM PDF</p>
          <p className="hero-buy-price">Tudo por <strong>R$ 10,00</strong></p>
          <CTA location="hero" />
          <p className="hero-buy-sub">Pagamento único • Sem assinatura • 7 dias de garantia</p>
        </div>
      </div>
    </section>
  );
}
const deliveryBenefits = [
  "150 receitas de doces em 10 capítulos organizados",
  "Fotos, ingredientes e modo de preparo passo a passo",
  "Doces virais, brigadeiros, cookies, brownies e doces no pote",
  "Dicas de rendimento, conservação, apresentação e precificação",
  "Ideias para testar um cardápio e buscar uma renda extra",
  "PDF com 167 páginas para consultar no celular ou computador",
];
export function PremiumBenefits({ ebook }: { ebook: EbookManifest }) {
  return (
    <section className="premium-benefits wrap" id="beneficios" aria-labelledby="benefits-title">
      <div className="premium-panel">
        <div className="premium-intro">
          <div>
            <p className="section-label">O QUE VOCÊ VAI RECEBER</p>
            <h2 id="benefits-title">Tudo para dar os <span>primeiros passos com seus doces.</span></h2>
            <p>Um material prático para aprender receitas, testar sabores e explorar oportunidades de renda extra.</p>
          </div>
          <div className="premium-edition">
            <Image src={ebook.images[0]} alt="Capa real do e-book" width={120} height={170} />
            <span>EDIÇÃO EM PDF</span>
          </div>
        </div>
        <ul className="delivery-checklist">
          {deliveryBenefits.map((benefit) => (
            <li key={benefit}><CheckCircle2 aria-hidden="true" size={27} strokeWidth={2.8} /><span>{benefit}</span></li>
          ))}
        </ul>
        <p className="premium-practice">As vendas e os ganhos dependem dos custos, do preparo e da demanda. O e-book não garante faturamento.</p>
        <div className="initial-offer" id="oferta-inicial">
          <h2>Leve tudo por <strong>R$ 10,00</strong></h2>
          <p>Pagamento único. Sem assinatura.</p>
          <CTA location="benefits" />
          <p className="delivery">PDF disponível após a aprovação do pagamento.</p>
        </div>
      </div>
    </section>
  );
}

export function PurchaseAssurances() {
  return (
    <section
      className="purchase-assurances wrap"
      id="garantia"
      aria-labelledby="assurances-title"
    >
      <div className="assurances-heading">
        <p className="section-label">PARA COMPRAR COM TUDO ÀS CLARAS</p>
        <h2 id="assurances-title">Seu pedido, sem complicação.</h2>
      </div>
      <div className="assurances-grid">
        <article className="guarantee-condition">
          <ShieldCheck size={27} aria-hidden="true" />
          <h3>{PURCHASE_TERMS.guaranteeDays} dias de garantia</h3>
          <p>
            Se não ficar satisfeito, solicite o reembolso em até{" "}
            {PURCHASE_TERMS.guaranteeDays} dias após a compra pelo nosso e-mail
            de atendimento.
          </p>
          <a href={`mailto:${PURCHASE_TERMS.supportEmail}`}>
            Solicitar atendimento
          </a>
        </article>
        <article>
          <CreditCard size={27} aria-hidden="true" />
          <h3>Pagamento único de R$ 10</h3>
          <p>
            Uma única compra. Sem mensalidade, sem assinatura e sem exigir
            criação de conta nesta página.
          </p>
        </article>
        <article>
          <Download size={27} aria-hidden="true" />
          <h3>PDF após a aprovação</h3>
          <p>
            Com o pagamento confirmado, o download é liberado aqui mesmo. Abra o
            arquivo no celular e consulte quando precisar.
          </p>
        </article>
      </div>
      <p className="guarantee-contact">
        Atendimento:{" "}
        <a href={`mailto:${PURCHASE_TERMS.supportEmail}`}>
          {PURCHASE_TERMS.supportEmail}
        </a>{" "}
        · <Link href="/termos">Condições da compra</Link>
      </p>
    </section>
  );
}
function WhatYouReceive({ ebook }: { ebook: EbookManifest }) {
  return (
    <div className="what-you-get" id="o-que-recebe">
      <div className="receive-heading">
        <p className="section-label">UM LIVRO PARA ABRIR E USAR</p>
        <h2>
          O que você recebe
          <br />
          por <span className="magenta">R$ 10.</span>
        </h2>
        <p>
          Da escolha do doce à sua primeira fornada, veja o que vem no arquivo.
        </p>
      </div>
      <div className="receive-layout">
        <div
          className="receive-book-stack"
          aria-label="Capa e exemplos de páginas do material entregue"
        >
          <Image
            className="receive-page receive-page-one"
            src={ebook.images[3]}
            alt="Página real com receita de cookie recheado"
            width={300}
            height={424}
          />
          <Image
            className="receive-page receive-page-two"
            src={ebook.images[5]}
            alt="Página real com receita de copo da felicidade"
            width={300}
            height={424}
          />
          <Image
            className="receive-cover"
            src={ebook.images[0]}
            alt="Capa da edição fotográfica em PDF"
            width={300}
            height={424}
          />
          <span className="receive-stamp">
            SEU LIVRO
            <br />
            <strong>167</strong> PÁGINAS
          </span>
        </div>
        <div className="receive-content">
          <article>
            <span>01</span>
            <div>
              <h3>150 receitas em 10 capítulos</h3>
              <p>
                Um repertório para experimentar, comparar sabores e escolher o
                que faz sentido para o seu cardápio.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Foto, ingredientes e modo de preparo</h3>
              <p>
                Receitas organizadas para acompanhar os ingredientes e consultar
                cada etapa na cozinha.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Rendimento, conservação e dicas de venda</h3>
              <p>
                Informações para orientar seus testes, a apresentação dos doces
                e o planejamento dos produtos.
              </p>
            </div>
          </article>
          <article>
            <span>04</span>
            <div>
              <h3>PDF para baixar e consultar</h3>
              <p>
                167 páginas para abrir no celular, tablet ou computador.
                Pagamento único, sem assinatura.
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

const recipeBlocks = [
  {
    image: 2,
    title: "Brigadeiros gourmet",
    detail: "Dos clássicos aos novos sabores.",
  },
  {
    image: 3,
    title: "Cookies recheados",
    detail: "Massa, recheio e possibilidades.",
  },
  {
    image: 4,
    title: "Brownies e blondies",
    detail: "Chocolate em diferentes versões.",
  },
  {
    image: 5,
    title: "Copos da felicidade",
    detail: "Camadas para montar e apresentar.",
  },
];
function RecipeCollection({ ebook }: { ebook: EbookManifest }) {
  return (
    <div className="recipe-collection" id="receitas-do-livro">
      <div className="collection-heading">
        <p className="section-label">UM GOSTINHO DOS CAPÍTULOS</p>
        <h2>
          Qual vai ser o primeiro
          <br />
          <span className="purple">doce da sua lista?</span>
        </h2>
      </div>
      <div className="recipe-blocks">
        {recipeBlocks.map((recipe) => (
          <article key={recipe.title}>
            <div className="recipe-photo">
              <Image
                src={ebook.images[recipe.image]}
                alt={`Fotografia de referência de ${recipe.title.toLowerCase()}, extraída da página real do livro`}
                width={778}
                height={1100}
                sizes="(max-width: 600px) 45vw, 440px"
              />
            </div>
            <div className="recipe-block-copy">
              <h3>{recipe.title}</h3>
              <p>{recipe.detail}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="collection-more">
        E ainda: doces virais, bolos no pote, tortas e cheesecakes, bombons e
        trufas, mousses e gelados, palhas e doces de corte.
      </p>
    </div>
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
export function InsideEbookGallery({ ebook }: { ebook: EbookManifest }) {
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
      <WhatYouReceive ebook={ebook} />
      <RecipeCollection ebook={ebook} />
      <div className="inside-heading">
        <p className="section-label">ABRA. ESCOLHA. PREPARE.</p>
        <h2>
          Veja o que você leva
          <br className="desktop-break" /> para a sua cozinha.
        </h2>
        <p className="gallery-help">
          Três receitas do livro. Toque em uma página para ampliar.
        </p>
      </div>
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
        <p className="section-label">CHECKOUT MERCADO PAGO</p>
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
      <CTA location="sticky">QUERO AS RECEITAS · R$ 10</CTA>
    </div>
  ) : null;
}
