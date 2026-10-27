"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import VIDEO from "@/public/product-video/source.json";

export function ProductPreviewVideo() {
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
      className="product-demo uploaded-video"
      ref={root}
      aria-label="Vídeo de apresentação do e-book"
    >
      <div className="demo-stage uploaded-video-screen">
        <div className="demo-pages">
          <Image
            className="demo-cover"
            src={VIDEO.poster}
            alt="Prévia estática das páginas do e-book mostradas no vídeo de apresentação"
            width={VIDEO.width}
            height={VIDEO.height}
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
              width={VIDEO.width}
              height={VIDEO.height}
              poster={VIDEO.poster}
              aria-label="Vídeo enviado do e-book passando em loop"
              onError={() => setFailed(true)}
            >
              <source src={VIDEO.mp4} type="video/mp4" />
            </video>
          )}
          {blocked && !reduced && (
            <button className="video-play" type="button" onClick={play}>
              ▶ Reproduzir prévia
            </button>
          )}
        </div>
      </div>
      <figcaption>
        <span>Veja as páginas do livro em movimento.</span>
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
