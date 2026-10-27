import Image from "next/image";
import testimonialsData from "@/content/testimonials.json";

type InstagramTestimonial = { image: string; alt: string };
const testimonials = testimonialsData as InstagramTestimonial[];

// Only user-supplied, authorized Instagram screenshots belong in this list.
// Until the real files are attached, publish no fabricated social proof.
export function Testimonials() {
  if (testimonials.length === 0) return null;
  return (
    <section className="instagram-proof" aria-labelledby="instagram-title">
      <p className="section-label">MENSAGENS DE QUEM RECEBEU O LIVRO</p>
      <h2 id="instagram-title">Olha o que chegou no Instagram.</h2>
      <div className="instagram-prints">
        {testimonials.map((item) => (
          <figure key={item.image}>
            <Image
              src={item.image}
              alt={item.alt}
              width={550}
              height={800}
              sizes="(max-width: 600px) 85vw, 380px"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
