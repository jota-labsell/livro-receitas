# Reconhecimento de Visa classificado como pré-pago

## Causa verificada

A consulta pública oficial do Mercado Pago, com a chave de produção da aplicação, retornou `credit_card` para a faixa de seis dígitos da captura e `prepaid_card` para a faixa de oito dígitos. O SDK consulta a faixa mais específica, enquanto o checkout configurava somente `creditCard`. Não foram enviados número completo, validade, CVV ou pagamentos. Os Workers temporários de diagnóstico foram removidos.

## Correção

- Configuração pública habilita `prepaidCard` somente para bandeiras ativas aceitas pelo provedor.
- O Payment Brick usa a opção oficial `prepaidCard`; o rótulo identifica crédito ou pré-pago.
- `selectedPaymentMethod`/`paymentType` do SDK preservam o tipo pré-pago na submissão.
- O backend valida bandeira e tipo permitido e transmite a modalidade ao Orders. Não converte silenciosamente um pré-pago em crédito.
- Preço, moeda, vendedor, idempotência, consulta autoritativa, webhook e autorização de download permanecem protegidos.

## Validação

Build Next.js/TypeScript passou. Os 24 testes de backend passaram, incluindo uma regressão com D1 local e provedor controlado que confere tipo, preço de R$ 10 e confirmação autoritativa. Três testes direcionados do checkout passaram em 360px, 402px e desktop, com SDK substituído exclusivamente nos testes. Débito, bandeira não permitida e Pix com tipo de cartão são rejeitados.

Esses testes não equivalem à aprovação de uma compra real nem ao sandbox oficial do Mercado Pago. Não houve cobrança nesta correção. A consulta de BIN comprova a classificação do provedor, não o produto contratado pelo cliente junto ao banco.

## Publicação

O código está preparado para revisão e integração à linha de produção. O checkout público não deve ser descrito como corrigido até que uma versão com essa alteração seja publicada e verificada. A guarda atual do deploy requer uma consulta de esquema no D1; a credencial cloud disponível recebeu 403 em consultas à API D1 na auditoria. O teste oficial de cartão pré-pago ainda precisa ser concluído em ambiente autorizado. Preserve os bindings e não publique a pasta antiga desta conversa.
