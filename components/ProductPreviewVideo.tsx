"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { EbookManifest } from "@/lib/ebook";
export function ProductPreviewVideo({ ebook }: { ebook?: EbookManifest }) {
  const root = useRef<HTMLElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(true),
    [visible, setVisible] = useState(false),
    [paused, setPaused] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (visible && !reduced && !paused)
      void video.current?.play().catch(() => {});
    else video.current?.pause();
  }, [visible, reduced, paused]);
  if (!ebook) return null;
  return (
    <figure className="product-demo" ref={root}>
      <div className="demo-stage">
        <Image
          className="demo-cover"
          src={ebook.images[0]}
          alt="Capa de 150 Doces para Comer e Vender, edição fotográfica"
          width={260}
          height={368}
          priority
        />
        <div className="demo-pages">
          <Image
            src={ebook.images[2]}
            alt="Página real: fotografia, ingredientes e modo de preparo do brigadeiro belga"
            width={540}
            height={764}
            priority
          />
          {!reduced && !failed && (
            <video
              ref={video}
              muted
              loop
              playsInline
              autoPlay
              preload="none"
              poster={ebook.images[2]}
              aria-label="Capa e páginas reais do livro, com ingredientes e preparo"
              onError={() => setFailed(true)}
            >
              <source src={ebook.video} type="video/webm" />
            </video>
          )}
        </div>
      </div>
      <figcaption>
        <span>Páginas reais da edição que você recebe.</span>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            {paused ? "Reproduzir prévia" : "Pausar prévia"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
