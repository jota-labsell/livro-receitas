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
        <h2>Recuperação de acesso</h2>
        <p>
          Quando necessário, o atendimento pode conferir sua compra e emitir um
          link privado válido por sete dias. Guardamos somente uma impressão
          criptográfica do token, vinculada ao pedido. O link permite abrir o
          acesso em outro navegador após nova verificação do pagamento. Um
          cookie essencial de recuperação dura no máximo até o vencimento do
          link; a revogação também bloqueia as sessões recuperadas. Não
          compartilhe esse link publicamente. A abertura de uma prévia automática
          não consome o acesso. Não há envio automático de e-mail de recuperação.
          O prazo definido para os registros de emissão e revogação é de 180 dias;
          para vínculos expirados de recuperação, 30 dias após o vencimento.
          A exclusão ocorre na próxima rotina de manutenção, acionada pelo uso
          do serviço de recuperação.
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
        <h2>Origem das visitas</h2><p>Quando a medição está permitida, registramos os parâmetros UTM, o caminho de entrada e o identificador transformado da sessão para relacionar visitas e pedidos. Esses dados de atribuição são mantidos por até 90 dias; o histórico de pagamentos é independente.</p><h2>Medição de anúncios da Meta</h2>
        <p>
          Em produção, usamos o Pixel da Meta e a API de Conversões para
          registrar visitas, visualização do produto, início do checkout e compras
          confirmadas. Enviamos produto, valor, moeda e um identificador do evento;
          não enviamos nome, e-mail, número de cartão ou dados preenchidos no checkout.
          Para associar uma compra ao anúncio, também podemos enviar o identificador
          do clique, identificadores de cookies da Meta, endereço IP e informações
          técnicas do navegador. O contexto de associação é mantido por até 48 horas.
          Sinais de privacidade enviados pelo navegador e preferências de medição já
          registradas são respeitados. A Meta pode usar cookies conforme sua própria
          política de privacidade. Não usamos captura automática de campos do checkout.
          A compra e a entrega funcionam independentemente da medição. Somente
          pagamentos aprovados e verificados no Mercado Pago geram compras pelo servidor;
          eventos do sandbox não são enviados. A Meta pode receber o evento sem
          atribuí-lo a uma campanha específica.
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
