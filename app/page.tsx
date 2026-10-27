import { EBOOK_PREVIEW } from "@/lib/ebook-preview";
import {
  HeroSection,
  InsideEbookGallery,
  OfferSection,
  Footer,
  MobileCTA,
} from "@/components/landing";
export const dynamic = "force-dynamic";
export default async function Home() {
  const ebook = EBOOK_PREVIEW;
  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="conteudo">
        <HeroSection ebook={ebook} />
        <InsideEbookGallery ebook={ebook} />
        <OfferSection />
      </main>
      <Footer />
      <MobileCTA />
    </>
  );
}
