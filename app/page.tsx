import {OperationVisit} from '@/components/operation-visit';
import { MetaPixel } from "@/components/MetaPixel";
import { PurchaseExperience } from "@/components/purchase-experience";
import { EBOOK_PREVIEW } from "@/lib/ebook-preview";
import {
  HeroSection,
  PremiumBenefits,
  PurchaseAssurances,
  InsideEbookGallery,
  OfferSection,
  Footer,
  MobileCTA,
} from "@/components/landing";
import { Testimonials } from "@/components/testimonials";
export const dynamic = "force-dynamic";
export default async function Home() {
  const ebook = EBOOK_PREVIEW;
  return (
    <>
      <PurchaseExperience><OperationVisit/>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="conteudo">
        <HeroSection />
        <Testimonials />
        <PremiumBenefits ebook={ebook} />
        <PurchaseAssurances />
        <OfferSection />
        <InsideEbookGallery ebook={ebook} />
      </main>
      <Footer />
      <MobileCTA />
      </PurchaseExperience>
      <MetaPixel />
    </>
  );
}
