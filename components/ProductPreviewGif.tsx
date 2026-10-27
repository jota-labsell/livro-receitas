"use client";
import { useEffect, useRef, useState } from "react";
import MEDIA from "@/public/product-video/source.json";

export function ProductPreviewGif() {
  const image = useRef<HTMLImageElement>(null);
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frozenFrame, setFrozenFrame] = useState(MEDIA.poster);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const pause = () => {
    try {
      const element = image.current;
      if (element?.complete && element.naturalWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = element.naturalWidth;
        canvas.height = element.naturalHeight;
        canvas.getContext("2d")!.drawImage(element, 0, 0);
        setFrozenFrame(canvas.toDataURL("image/png"));
      }
    } catch {
      setFrozenFrame(MEDIA.poster);
    }
    setPaused(true);
  };

  const animated = !reduced && !paused && !failed;
  const src =
    reduced || failed ? MEDIA.poster : paused ? frozenFrame : MEDIA.gif;

  return (
    <figure
      className="product-demo ebook-gif"
      aria-label="Prévia de rolagem das páginas do e-book"
    >
      <div
        className="demo-stage ebook-gif-screen"
        style={{ aspectRatio: `${MEDIA.gifWidth} / ${MEDIA.gifHeight}` }}
      >
        <div className="demo-pages">
          <img
            ref={image}
            className="demo-cover product-gif"
            src={src}
            alt={
              animated
                ? "Animação em loop da rolagem das páginas do e-book"
                : "Prévia estática de uma página do e-book"
            }
            width={MEDIA.gifWidth}
            height={MEDIA.gifHeight}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setFailed(true)}
          />
        </div>
      </div>
      <figcaption>
        <span>Páginas do livro, com fotos, ingredientes e preparo.</span>
        {!reduced && !failed && (
          <button
            type="button"
            aria-pressed={paused}
            onClick={() => (paused ? setPaused(false) : pause())}
          >
            {paused ? "Reproduzir prévia" : "Pausar prévia"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
