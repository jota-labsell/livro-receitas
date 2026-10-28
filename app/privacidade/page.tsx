import Link from "next/link";
import { Footer } from "@/components/landing";
export const metadata = { title: "Privacidade | 150 Doces" };
export default function Privacy() {
  return (
    <>
      <main className="wrap legal">
        <Link href="/">← Voltar para o livro</Link>
        <h1>Privacidade</h1>
        <p>
          Receitas Premium opera esta página. Para dúvidas sobre seus dados,
          entre em contato pelo e-mail{" "}
          <a href="mailto:receitaspremium150@gmail.com">
            receitaspremium150@gmail.com
          </a>
          .
        </p>
        <h2>Dados para pagar</h2>
        <p>
          O checkout oficial do Mercado Pago solicita os dados necessários ao
          meio de pagamento escolhido, como e-mail e identificação. Os dados de
          cartão são tratados pelo provedor; esta aplicação não armazena número
          de cartão, código de segurança ou token de cartão. O servidor envia a
          solicitação de pagamento ao Mercado Pago por conexão protegida.
        </p>
        <h2>Registro da compra e entrega</h2>
        <p>
          Para processar a compra e autorizar o PDF, registramos identificador
          do pedido e do pagamento, produto, valor, moeda, horários, situação do
          pagamento e uma impressão de verificação da solicitação. Não guardamos
          nome ou e-mail em uma lista de marketing. Um cookie essencial,
          protegido contra acesso por JavaScript, identifica sua compra neste
          navegador por até 30 dias. Não é necessário criar conta.
        </p>
        <h2>Medição da página</h2>
        <p>
          Medimos visualização da oferta, clique no botão, início do checkout e
          compra confirmada. Os eventos usam um identificador aleatório da
          visita, transformado no servidor. Não contêm nome, e-mail ou dados de
          pagamento. Esses registros internos são mantidos no D1. O identificador da visita fica no armazenamento da
          sessão do navegador. A compra é registrada somente pelo backend após
          validação.
        </p>
        <h2>Medição de anúncios da Meta</h2>
        <p>
          Em produção, se você permitir a medição, usamos o Pixel da Meta para
          registrar visitas, visualização do produto, início do checkout e compras
          confirmadas. Enviamos produto, valor, moeda e um identificador do evento;
          não enviamos nome, e-mail, número de cartão ou dados preenchidos no checkout.
          A Meta também recebe informações técnicas do navegador e pode usar cookies
          conforme sua própria política de privacidade. Não usamos correspondência
          avançada automática. Você pode recusar ou alterar sua escolha em
          “Preferências de privacidade”, no final da página de venda. A compra e a entrega
          funcionam independentemente dessa escolha. Eventos do sandbox não são
          enviados ao Pixel. Quando a API de Conversões estiver habilitada no servidor,
          também poderemos enviar à Meta uma compra confirmada, somente após sua permissão
          para medição. Nesse caso, o servidor confere o pagamento e envia identificador
          de evento, identificador aleatório da visita protegido por hash, valor, moeda,
          produto e, quando disponíveis, informações técnicas do navegador como agente
          do usuário e identificador _fbp. Não enviamos número do cartão, código de
          segurança, e-mail ou nome. O evento do servidor usa o mesmo identificador do
          Pixel para evitar contagem duplicada. Bloqueadores ou restrições do navegador
          podem impedir a entrega dos eventos. A API permanece desligada até a ativação
          explícita no ambiente de produção.
        </p>
        <h2>Serviços e segurança</h2>
        <p>
          Cloudflare hospeda a página, os pedidos e o arquivo privado. Mercado
          Pago processa os pagamentos conforme sua própria política de
          privacidade. Registros técnicos de infraestrutura podem conter
          informações de conexão para segurança e diagnóstico. O PDF completo
          não é um arquivo público.
        </p>
        <h2>Contato e direitos</h2>
        <p>
          Você pode solicitar acesso, correção ou exclusão de dados pelo contato
          acima. Registros de compra podem precisar ser mantidos para cumprir
          obrigações legais, atender reclamações e prevenir fraude; o
          atendimento informará o que pode ser excluído e os prazos aplicáveis.
          Limpar o cookie remove o acesso automático ao pedido neste navegador.
          Se isso acontecer, fale com o atendimento para localizar sua compra.
        </p>
      </main>
      <Footer />
    </>
  );
}
