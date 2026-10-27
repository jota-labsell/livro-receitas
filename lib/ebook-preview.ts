import manifestData from "@/public/ebook/manifest.json";

export type EbookManifest = {
  sha256: string;
  pages: number;
  images: string[];
  video: string;
  videoMp4?: string;
  gif: string;
  bytes?: number;
};

// These public samples are generated from the exact edition identified by SHA-256.
// Showing a sample never grants access to the private, complete PDF.
export const EBOOK_PREVIEW: EbookManifest = manifestData;
