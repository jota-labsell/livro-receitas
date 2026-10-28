# Checkout Orders — validação antes da ativação

O fluxo HTTP do site agora usa `POST /v1/orders`, `GET /v1/orders/{id}` e busca por referência em `GET /v1/orders`. O Payment Brick coleta os dados; o servidor define R$ 10,00/BRL e cria a cobrança. Orders pendentes mostram o Pix copia e cola retornado pelo servidor, quando disponível; não passam um ID de Order ao Status Screen legado.

## Estado desta entrega

- Adaptador implementado para sandbox, com `X-Test-Scope: sandbox` nas operações Orders.
- `CHECKOUT_ENABLED=false` permanece no repositório.
- Produção é recusada pelo adaptador até uma entrega posterior à validação oficial. Não basta mudar flags para cobrar em produção.
- Credenciais reais não estão disponíveis neste ambiente. Testes locais usam respostas simuladas e não comprovam aceitação dos campos pelo sandbox.
- O D1 configurado é `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`, binding `ORDERS`. As tabelas foram confirmadas pelo usuário no painel.
- R2: bucket privado `receitas-premium-150-ebooks`, binding `EBOOKS`. O usuário adicionou o PDF único conforme o manifesto; a integridade remota ainda deve ser validada por download autorizado.

## Configurar no Worker

Secrets: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_COLLECTOR_ID`, `MERCADOPAGO_WEBHOOK_SECRET`. As credenciais e o ID devem pertencer ao vendedor correto do ambiente de teste.

Variáveis: `SITE_URL=https://livro-receitas.joaolucasqtb.workers.dev`, `MERCADOPAGO_MODE=sandbox`, `LIVE_PAYMENTS_ENABLED=false`.

Webhook de teste: evento **Order (Mercado Pago)**, tópico `order`, destino `/api/webhooks/mercadopago`. A assinatura HMAC é conferida com o ID alfanumérico em minúsculas no manifesto de assinatura, mantendo o ID original para consulta. O corpo e a query devem identificar o mesmo pedido.

## Publicação do sandbox

Use a branch `feat/150-doces-r10` com esta entrega, build `npm run cloudflare:build` e deploy `npm run cloudflare:deploy:sandbox`. O comando `cloudflare:deploy:vitrine` omite D1 e desativa pagamentos; não serve para testar o checkout.

Depois de confirmar os secrets e bindings, publique com o comando acima. Ele gera uma configuração local ignorada pelo Git com checkout de teste habilitado, origem HTTPS definida e cobranças reais desativadas. O `wrangler.jsonc` padrão continua desativado. Para conferir sem publicar: `npm run cloudflare:deploy:sandbox -- --dry-run`. Confira `GET /api/checkout`: `available:true` exige que o PDF esteja acessível e que a conta retorne meios de pagamento ativos. Não publique o token em logs ou capturas.

## Matriz oficial ainda pendente

1. Cartão de teste aprovado e recusado; conferir no painel o pedido e a conta recebedora.
2. Pix pendente e aprovado, se disponível; conferir código, consulta manual e webhook real.
3. Conferir a resposta real: `currency`, `user_id`, valores, `last_updated_date`, transação e estados. Campos ausentes ou divergentes bloqueiam o download; não relaxar validação para passar no teste.
4. Duplo clique, resposta perdida e recarregamento: uma cobrança e um evento de compra. Pedidos sem resposta são recuperados por referência e consultados individualmente.
5. Webhook assinado real, repetido, alterado e fora de ordem. Não conceder acesso por callback do navegador.
6. Download sem cookie ou sem aprovação bloqueado; após aprovação, PDF com SHA-256 igual ao manifesto. Estorno/contestação revogam acesso.
7. Se houver desafio 3DS, validar o fluxo oficial antes de produção. Esta entrega não implementa interface de desafio; estados não reconhecidos permanecem pendentes.

Sem completar essa matriz não há aprovação para cobranças reais. Depois dela, revisar o contrato observado, concluir os casos necessários e remover a restrição de produção em uma entrega validada.

## Referências de contrato consultadas

SDK Node.js oficial do Mercado Pago (tipos e endpoints Orders):
- https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/order/create/types.ts
- https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/order/commonTypes.ts
- https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/order/search/types.ts
- https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/order/search/index.ts

O portal público de documentação retornou uma página de erro neste ambiente; as particularidades de sandbox, os estados e a compatibilidade do Brick ainda precisam ser conferidos no teste oficial.

## Base visual preservada

Integração aplicada sobre `9cdcf2b`, que inclui o vídeo MP4 nativo dos commits `38f37fb` e `82d8303`. Componente da prévia, layout, estilos e arquivos de mídia permanecem iguais a essa base. As melhorias de carregamento e envio do Brick de `f9ae6cf` também foram preservadas.
