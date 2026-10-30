# Compras automáticas pelo servidor

Novos checkouts registram a preferência de medição e, quando disponíveis,
`fbp`, `fbc`, navegador, endereço IP e a URL sem query ou fragmento. O `fbc`
é capturado de um clique real (`fbclid`) ou cookie existente. Não é inventado
na ausência de clique. Não são enviados nome, e-mail ou dados de cartão.
Preferências de recusa existentes e o sinal Global Privacy Control são
respeitados. Não foi acrescentado banner ou etapa ao checkout.

Após confirmação autoritativa do Mercado Pago, a reconciliação grava uma
entrada única em `meta_purchase_delivery`. O Worker envia o evento em
`waitUntil` após as respostas de pagamentos, status e webhook. Se o comprador
fechar a página ou uma tentativa falhar, um cron no mesmo Worker, a cada
cinco minutos, processa a fila. Não depende do aplicativo JotaFy ou de
um navegador aberto.

O Purchase real não contém `test_event_code`. Seu `event_id` é o mesmo hash
de pedido retornado ao Pixel, preservado em todas as tentativas. Uma reserva
atômica evita envios concorrentes; se a Meta receber e a resposta se perder,
o mesmo identificador permite deduplicar a retentativa. Somente confirmação
`events_received` marca a entrega como `sent`. Falhas transitórias recebem
retentativas graduais, até 12 tentativas dentro de 48 horas. Erros definitivos
de autenticação/parâmetros interrompem tentativas e aparecem no painel.

Pendências, pagamentos recusados, sandbox, reembolsos, contestações e pedidos
sem medição habilitada não geram Purchase. A implantação não cria pedidos ou
cobranças, nem importa compras históricas sem contexto prévio de medição.
O contexto técnico é excluído após 48 horas; pedidos e pagamentos são mantidos.

## Publicação

Aplicar somente `0007_meta_capi.sql` (se ainda ausente) e
`0009_meta_automatic.sql` ao D1 de produção existente e registrar no histórico.
Ambas são aditivas e repetíveis. Depois publicar o build com `worker.ts` como
entrada e cron `*/5 * * * *`. `META_CAPI_ENABLED=true` fica na configuração;
`META_CAPI_ACCESS_TOKEN` permanece como secret existente no Worker.
O script de produção verifica as tabelas antes de publicar.

O painel `/admin/meta` mostra a ativação e, por compra, estado, tentativas,
HTTP, código de erro e rastreamento da Meta. Não mostra token, IP ou cookies.
Uma venda recebida não garante atribuição à campanha; o vínculo depende dos
identificadores e das regras da Meta. A primeira compra real após a implantação
é a comprovação operacional de entrega automática, sem criar compra fictícia.

## Validação

`npm run test:meta` exercita o webhook assinado, a fila, a concorrência,
retentativas, deduplicação, recusa, sandbox, reembolso, ausência de backfill,
diagnósticos e retenção. O wrapper de produção e o transporte são executados
em workerd/Miniflare, com o Next HTTP e a Meta simulados. Testes não enviam
conversões reais. `npm run test:meta:ui` verifica captura e persistência do
clique, ausência de clique inventado, recusa e GPC no navegador.
