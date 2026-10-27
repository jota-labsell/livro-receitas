"use client";
import { useEffect, useRef, useState } from "react";
import MEDIA from "@/public/product-video/source.json";

export function ProductPreviewGif() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || paused || videoFailed) return;
    const attempt = video.play();
    if (attempt) attempt.catch(() => setVideoFailed(true));
  }, [paused, reducedMotion, videoFailed]);

  const showVideo = !reducedMotion && !videoFailed;
  const showGif = !reducedMotion && videoFailed && !gifFailed;

  return (
    <figure className="product-demo ebook-gif" aria-label="Prévia real das páginas do e-book">
      <div className="demo-stage ebook-gif-screen">
        {showVideo ? (
          <video
            ref={videoRef}
            className="product-preview-media"
            src={MEDIA.mp4}
            poster={MEDIA.poster}
            width={MEDIA.width}
            height={MEDIA.height}
            muted
            autoPlay
            playsInline
            loop
            preload="metadata"
            aria-label="Vídeo folheando o e-book"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <img
            className="product-preview-media"
            src={showGif ? MEDIA.gif : MEDIA.poster}
            alt={showGif ? "Animação folheando o e-book" : "Prévia do e-book"}
            width={MEDIA.gifWidth}
            height={MEDIA.gifHeight}
            decoding="async"
            onError={() => setGifFailed(true)}
          />
        )}
      </div>
      <figcaption>
        <span>Veja páginas reais do e-book por dentro.</span>
        {showVideo && (
          <button
            type="button"
            aria-pressed={paused}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              if (paused) {
                video.play().then(() => setPaused(false)).catch(() => setVideoFailed(true));
              } else {
                video.pause();
                setPaused(true);
              }
            }}
          >
            {paused ? "Reproduzir vídeo" : "Pausar vídeo"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
