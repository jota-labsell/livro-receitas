"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { EbookManifest } from "@/lib/ebook-preview";

export function ProductPreviewVideo({ ebook }: { ebook: EbookManifest }) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
    if (visible && !reduced && !paused) {
      const element = video.current;
      if (element)
        void element
          .play()
          .then(() => setBlocked(false))
          .catch(() => setBlocked(true));
    } else video.current?.pause();
  }, [visible, reduced, paused]);

  const play = () => {
    setPaused(false);
    void video.current
      ?.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  };

  return (
    <figure
      className="product-demo"
      ref={root}
      aria-label="Prévia em vídeo do livro de receitas"
    >
      <div className="demo-stage">
        <div className="demo-orbit" aria-hidden="true" />
        <Image
          className="demo-cover"
          src={ebook.images[0]}
          alt="Capa de 150 Doces para Comer e Vender, edição fotográfica"
          width={260}
          height={368}
          priority
        />
        <Image
          className="demo-back-page"
          src={ebook.images[5]}
          alt=""
          aria-hidden="true"
          width={260}
          height={368}
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
              preload="metadata"
              poster={ebook.images[2]}
              aria-label="Capa e páginas reais do livro passando em loop"
              onError={() => setFailed(true)}
            >
              {ebook.videoMp4 && (
                <source src={ebook.videoMp4} type="video/mp4" />
              )}
              <source src={ebook.video} type="video/webm" />
            </video>
          )}
          {blocked && !reduced && (
            <button className="video-play" type="button" onClick={play}>
              ▶ Reproduzir prévia
            </button>
          )}
        </div>
        <span className="demo-caption">
          <span aria-hidden="true">●</span> FOLHEIE O SEU PRÓXIMO LIVRO DE
          RECEITAS
        </span>
      </div>
      <figcaption>
        <span>Capa e páginas reais. Fotos, ingredientes e preparo.</span>
        {!reduced && !failed && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
          >
            {paused ? "Reproduzir prévia" : "Pausar prévia"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
