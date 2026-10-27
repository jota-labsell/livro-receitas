import { json } from "@/lib/http";
export async function POST() {
  return json(
    { error: "O acesso gratuito foi encerrado. Faça o pagamento no checkout." },
    410,
  );
}
