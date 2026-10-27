import Link from "next/link";
import { Footer } from "@/components/landing";
export const metadata = { title: "Termos | 150 Doces" };
export default function Terms() {
  return (
    <>
      <main className="wrap legal">
        <Link href="/">← Voltar para o livro</Link>
        <h1>Termos da compra</h1>
        <h2>O produto e o preço</h2>
        <p>
          150 Doces para Comer e Vender, edição fotográfica em PDF: 150 receitas
          em 10 capítulos e 167 páginas. A compra custa R$ 10,00 em pagamento
          único, sem assinatura ou produtos adicionais. Não há entrega de livro
          impresso.
        </p>
        <h2>Pagamento e recebimento</h2>
        <p>
          O pagamento é processado pelo Mercado Pago com os meios disponíveis no
          checkout. Após a confirmação pelo backend, o download autorizado fica
          disponível nesta página. Um pagamento pendente ainda não libera o
          arquivo. Use o mesmo navegador para consultar o status e baixar. Se
          precisar de ajuda ou perder o acesso no navegador, contate{" "}
          <a href="mailto:receitaspremium150@gmail.com">
            receitaspremium150@gmail.com
          </a>{" "}
          com a referência de sua compra; não envie dados de cartão.
        </p>
        <h2>Atendimento e cancelamento</h2>
        <p>
          Pedidos de suporte, cancelamento e reembolso são atendidos pelo e-mail
          acima, observando os direitos aplicáveis ao consumidor. Esta oferta
          não anuncia garantia comercial adicional. Pagamentos estornados ou
          contestados não autorizam novos downloads.
        </p>
        <h2>Uso do material</h2>
        <p>
          Você pode preparar e vender os doces. Distribuir, revender ou
          reproduzir o próprio e-book exige autorização dos titulares.
          Fotografias de referência ilustram preparações semelhantes; não
          representam o resultado exato de cada receita.
        </p>
        <h2>Preparo e resultados</h2>
        <p>
          Teste ingredientes, técnicas, rendimento, higiene, conservação e
          precificação antes de vender. Algumas receitas exigem prática. Não há
          promessa de renda, lucro ou vendas garantidas. Não há vínculo oficial
          com redes sociais ou influenciadoras.
        </p>
      </main>
      <Footer />
    </>
  );
}
