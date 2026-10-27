"use client";
import { useEffect, useRef, useState } from "react";
import MEDIA from "@/public/product-video/source.json";

/**
 * Native HTML5 video, following the working Pequenos Construtores preview:
 * autoplay + muted + loop + playsInline + MP4 source + poster.
 * Never silently replace a blocked autoplay with a static poster: offer play.
 */
export function ProductPreviewGif() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [gifError, setGifError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = () => {
      if (video.paused && !videoError) {
        video.muted = true;
        video.play().then(() => setPlayBlocked(false)).catch(() => setPlayBlocked(true));
      }
    };
    tryPlay();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !videoError) tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [videoError]);

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = true;
      await video.play();
      setPlayBlocked(false);
    } catch {
      setPlayBlocked(true);
    }
  };

  return (
    <figure className="product-demo ebook-gif" aria-label="Prévia animada das páginas do e-book">
      <div className="demo-stage ebook-gif-screen">
        {!videoError ? (
          <>
            <video
              ref={videoRef}
              className="product-preview-media"
              autoPlay
              muted
              loop
              playsInline
              disablePictureInPicture
              poster={MEDIA.poster}
              width={MEDIA.width}
              height={MEDIA.height}
              preload="auto"
              aria-label="Prévia animada folheando as receitas do e-book"
              onPlaying={() => { setIsPlaying(true); setPlayBlocked(false); }}
              onPause={() => setIsPlaying(false)}
              onError={() => setVideoError(true)}
            >
              <source src={MEDIA.mp4} type="video/mp4" />
              Seu navegador não suporta reprodução de vídeo.
            </video>
            {playBlocked && (
              <button className="preview-play-overlay" type="button" onClick={handlePlay}>
                ▶ Reproduzir prévia
              </button>
            )}
          </>
        ) : !gifError ? (
          <img
            className="product-preview-media"
            src={MEDIA.gif}
            width={MEDIA.gifWidth}
            height={MEDIA.gifHeight}
            alt="GIF animado mostrando as receitas do e-book"
            decoding="async"
            onError={() => setGifError(true)}
          />
        ) : (
          <img
            className="product-preview-media"
            src={MEDIA.poster}
            width={MEDIA.width}
            height={MEDIA.height}
            alt="Capa da prévia do e-book"
          />
        )}
      </div>
      <figcaption>
        <span>Veja as páginas reais do livro passando na tela.</span>
        {!videoError && (
          <button type="button" onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) void handlePlay();
            else video.pause();
          }}>
            {isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
