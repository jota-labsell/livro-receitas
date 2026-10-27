"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import testimonialsData from "@/content/testimonials.json";

type InstagramTestimonial = {
  image: string;
  title: string;
  alt: string;
  width: number;
  height: number;
};
const testimonials = testimonialsData as InstagramTestimonial[];

export function Testimonials() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState(0);
  const close = () => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  if (testimonials.length === 0) return null;
  const current = testimonials[selected];
  return (
    <section
      className="instagram-proof wrap"
      id="depoimentos"
      aria-labelledby="instagram-title"
    >
      <p className="section-label">MENSAGENS DE QUEM RECEBEU O LIVRO</p>
      <h2 id="instagram-title">Olha o que chegou no Instagram.</h2>
      <p className="instagram-help">
        Toque em um print para ampliar e ler a conversa.
      </p>
      <div className="instagram-prints">
        {testimonials.map((item, index) => (
          <figure key={item.image}>
            <button
              type="button"
              className="testimonial-open"
              aria-label={`Ampliar depoimento: ${item.title}`}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setSelected(index);
                dialog.current?.showModal();
              }}
            >
              <Image
                src={item.image}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(max-width: 600px) 85vw, 260px"
              />
              <span className="testimonial-expand" aria-hidden="true">
                ＋
              </span>
            </button>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="gallery-modal testimonial-modal"
        aria-label="Depoimento ampliado do Instagram"
        onCancel={close}
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <div className="modal-toolbar">
          <p>PRINT DO INSTAGRAM · {current.title.toUpperCase()}</p>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar depoimento ampliado"
          >
            ✕
          </button>
        </div>
        <div className="modal-image">
          <Image
            src={current.image}
            alt={current.alt}
            width={current.width}
            height={current.height}
          />
        </div>
        <div className="modal-controls">
          <p>Arraste o print para ler a conversa.</p>
          <button type="button" onClick={close}>
            Fechar
          </button>
        </div>
      </dialog>
    </section>
  );
}
