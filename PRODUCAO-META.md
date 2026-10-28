# Publicar vendas reais e preparar Meta Ads

## O que foi comprovado

O usuário confirmou aprovação no sandbox e recebimento do PDF. O Codex local confirmou recibos reais de webhook da compra aprovada e da tentativa recusada, um pedido aprovado com um único evento interno purchase_approved e nenhum pedido com eventos duplicados nos registros consultados. Isso não comprova pagamentos de produção ou envio à Meta.

## Atualizar o banco antes de publicar este código

Esta versão separa os pedidos por ambiente. Compras existentes permanecem sandbox e a sessão não recupera um pedido de outro ambiente. A migration é aditiva e não apaga compras.

No terminal autenticado, após atualizar a branch feat/150-doces-r10:

```sh
npx wrangler d1 migrations apply receitas-premium-150-orders --remote
```

A migration 0001 usa CREATE IF NOT EXISTS e pode reconhecer tabelas criadas manualmente. A 0002 adiciona environment. Não execute o ALTER manualmente se já aplicou a migration, nem apague registros para contornar erros.

## Trocar para credenciais reais

Primeiro desative temporariamente o checkout no Worker (`CHECKOUT_ENABLED=false`) para não misturar credenciais durante a troca. No Mercado Pago Developers, abra a mesma aplicação em Produção e conclua as solicitações da conta. No Worker livro-receitas, atualize as quatro entradas correspondentes à produção: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_COLLECTOR_ID e MERCADOPAGO_WEBHOOK_SECRET. Use Secrets. Collector ID deve pertencer ao vendedor real; não reutilize o vendedor de teste. Nenhum valor deve ser enviado ao chat ou Git.

Configure a URL https://livro-receitas.joaolucasqtb.workers.dev/api/webhooks/mercadopago no ambiente de produção, evento Order (Mercado Pago), com o segredo de produção correspondente. Não regenere a chave de teste para usá-la como chave de produção.

## Build e publicação explícita

```sh
npm run cloudflare:build
npm run cloudflare:deploy:production -- --dry-run
npm run cloudflare:deploy:production
```

O último comando habilita cobranças REAIS. Não o execute enquanto as credenciais e webhook forem de teste. Ele verifica a existência da coluna environment no D1 remoto antes do envio. As simulações não fazem cobrança nem comprovam permissões remotas.

Se o deploy for pelo Git da Cloudflare, altere o comando de publicação para npm run cloudflare:deploy:production somente depois dessa configuração. O comando deploy:sandbox continuará forçando teste. O wrangler.jsonc padrão permanece com checkout desativado.

## Conferir antes dos anúncios

GET /api/checkout deve retornar available:true e mode:production. Faça uma compra real autorizada de R$10, com comprador e meio de pagamento legítimos permitidos pelo provedor, confira no painel, webhook, PDF e um único evento de compra. A pessoa que compra deve saber que será uma cobrança real. Não use cartões de teste em produção. Caso precise de estorno, processe-o pelo provedor e valide a revogação de acesso.

Se o pedido exigir autenticação 3DS, valide esse fluxo antes da campanha; esta versão não implementa interface dedicada de desafio. Verifique também a disponibilidade de Pix na conta real; não suponha que o resultado no sandbox será igual.

Para consultar somente compras reais no D1:

```sql
SELECT o.id, o.status, COUNT(f.event_key) AS purchase_events
FROM orders o
LEFT JOIN funnel_events f ON f.order_id=o.id AND f.name='purchase_approved'
WHERE o.environment='production'
GROUP BY o.id, o.status;
```

## Meta Ads — configuração ainda pendente

O Pixel informado é 1150409944170993 e está integrado pelo navegador, apenas em produção com checkout e cobranças reais habilitados e com permissão de medição do visitante. A tabela funnel_events continua sendo um registro interno separado. Não há API de Conversões configurada nem campanha publicada por esta entrega.

No Gerenciador de Eventos da Meta, selecione a empresa correta, use Conectar dados → Web e crie um Pixel/conjunto de dados. As opções podem variar por conta. Copie o ID numérico e forneça somente esse ID para a integração; não envie token de acesso. Se houver exigência de domínio próprio/verificação de domínio, configure um domínio controlado pelo vendedor.

Depois de integrar, conferir em Testar eventos: PageView/ViewContent na oferta, InitiateCheckout no checkout e Purchase somente para pedidos de PRODUÇÃO confirmados pelo backend. Valor 10.00, moeda BRL, identificador estável do evento para deduplicação. Não enviar nome, e-mail ou dados de pagamento. Definir a preferência de medição e atualizar a política de privacidade conforme a integração realmente ativada. Testes do sandbox não devem alimentar a campanha como compras reais.

Para preparar a campanha faltam validação do Pixel no Gerenciador de Eventos, acesso à conta de anúncios, orçamento diário e criativos. Usar objetivo de Vendas, destino site, evento de compra após validação; público, orçamento e criativos precisam ser definidos pelo anunciante. Nenhum gasto é iniciado automaticamente.

## Dependências

O alerta de quatro vulnerabilidades altas vinha de uma dependência transitiva: glob 10.3.3 no minificador. A dependência foi substituída por glob 10.5.0 dentro da mesma versão principal usando override específico, sem npm audit fix --force e sem trocar Next.js/OpenNext. A auditoria e o build devem ser conferidos após npm ci no computador usado para publicar.

## Pixel 1150409944170993

Eventos: PageView, ViewContent, InitiateCheckout, OfferCTAClick (personalizado) e Purchase. O SDK só carrega após permitir medição. Purchase exige recibo de produção aprovado e confirmado pelo backend. O eventID é derivado do pedido e estável nas consultas. Memória e localStorage evitam reenvio no mesmo navegador; bloqueadores e fechar a página antes da confirmação podem impedir o envio. A contagem interna do D1 independe do Pixel. Não enviar nome, e-mail ou campos de pagamento; autoConfig e correspondência avançada automática não são ativados.

No Gerenciador de Eventos → Pixel 1150409944170993 → Testar eventos, abra o site após publicar em produção, permita a medição e confira os eventos. Purchase deve aparecer após compra real aprovada, value 10 e currency BRL. O sandbox não envia eventos à Meta. Não instale um segundo Purchase pelo Event Setup Tool.

Validação concluída após restaurar o ambiente: 16 testes de backend, 15 cenários de interface/Pixel em 360px, 402px e desktop e build OpenNext/Worker passaram. Integração aplicada sobre 56eb28c, preservando as configurações, os callbacks e o conteúdo do checkout criado pelo usuário. Os ajustes de layout ampliam a área útil móvel e separam os blocos. Os testes de SDK simulado não comprovam recebimento real pela Meta; conferir no Gerenciador de Eventos após publicar em produção.
