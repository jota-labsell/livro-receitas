import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/runtime";
import "./globals.css";
import localFont from "next/font/local";
const manrope = localFont({ src: "./fonts/manrope.ttf", display: "swap" });
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  return {
    metadataBase: new URL(
      siteUrl() ||
        `${h.get("x-forwarded-proto") || "https"}://${h.get("host") || "localhost:3000"}`,
    ),
    title: "150 Doces para Comer e Vender | R$ 10,00",
    description:
      "150 receitas, 10 capítulos e 167 páginas em PDF. Fotografia, ingredientes e preparo organizado. R$ 10,00 em pagamento único.",
    openGraph: {
      title: "150 Doces para Comer e Vender",
      description:
        "150 receitas para preparar e vender. Edição fotográfica em PDF por R$ 10,00.",
      locale: "pt_BR",
      type: "website",
      images: [
        {
          url: "/ebook/page-0.webp",
          width: 778,
          height: 1100,
          alt: "Capa da edição fotográfica de 150 Doces para Comer e Vender",
        },
      ],
    },
    robots: { index: true, follow: true },
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={manrope.className}>{children}</body>
    </html>
  );
}
