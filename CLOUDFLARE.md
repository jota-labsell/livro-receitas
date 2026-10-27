# Workers + OpenNext + D1 + R2 privado

## Bloqueios observados

Credenciais do Mercado Pago ausentes. O token Cloudflare configurado não conseguiu listar D1 (erro de autenticação 10000). A integração do pagamento está implementada, mas o checkout continua desativado e o ID do D1 ainda precisa ser preenchido. Não envie tokens pelo chat. Ajuste permissões no gerenciador seguro da conta/ambiente: Workers Scripts, R2 Storage e D1, para a conta correta.

## Publicar a vitrine enquanto D1 e Mercado Pago estão pendentes

Este projeto é um **Worker com OpenNext**, não uma aplicação estática do Pages. Um deploy verde em `pages.dev` não executa o servidor Next.js. Use o endereço `workers.dev` retornado pelo deploy.

```sh
npm run cloudflare:build
npm run cloudflare:deploy:vitrine -- --dry-run
npm run cloudflare:deploy:vitrine
```

O último comando publica a vitrine no Worker já configurado. Ele gera uma configuração local ignorada pelo Git que omite o D1 e força `CHECKOUT_ENABLED=false` e `LIVE_PAYMENTS_ENABLED=false`. O R2 continua privado e as páginas reais do livro são demonstradas. Nenhum pagamento ou download completo é liberado. Eventos estão preparados no código, mas não são persistidos neste modo sem D1.

No painel, a integração Git deve ser criada em **Workers**, usando a branch `feat/150-doces-r10`, build `npm run cloudflare:build` e deploy `npm run cloudflare:deploy:vitrine`. O projeto Pages anterior pode permanecer enquanto o Worker é validado. O aviso de conta Git desconectada deve ser resolvido na integração Git da Cloudflare para futuros deploys automáticos; ele não impede publicação pela CLI autenticada.

Depois de configurar D1 e testar o Mercado Pago, use o fluxo completo abaixo. `cloudflare:deploy:vitrine` continuará sempre bloqueando cobranças.

## Infraestrutura

1. Depois de corrigir a permissão, use `npx wrangler d1 list`. Reutilize `receitas-premium-150-orders` se existir; caso contrário, `npx wrangler d1 create receitas-premium-150-orders`. Copie o ID real para `wrangler.jsonc`, binding `ORDERS`.
2. Aplique a migration: `npx wrangler d1 migrations apply receitas-premium-150-orders --remote`. Para testes locais use `--local`. A migration é aditiva e não contém credenciais.
3. Reutilize o bucket **privado** `receitas-premium-150-ebooks`, binding `EBOOKS`. Confira no painel que `r2.dev` e domínios públicos não estão ativos. Acesso à API não comprova essa configuração: verifique-a antes do lançamento.
4. Coloque o PDF original em `private/150-doces.pdf`. `node scripts/cloudflare-ebook.mjs --remote` confere o SHA-256 antes de enviar para a chave do manifesto. Sem `--remote`, prepara o R2 local.
5. Configure `SITE_URL` com a origem HTTPS final, sem barra no final. O cookie de compra usa HTTPS.

## Sandbox oficial obrigatório

Configure, através dos segredos do Worker ou do ambiente seguro de teste, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` e `MERCADOPAGO_COLLECTOR_ID`. Use credenciais e conta de comprador de teste oficiais, sem cartão real. `MERCADOPAGO_MODE=sandbox`, `CHECKOUT_ENABLED=true` e `LIVE_PAYMENTS_ENABLED=false`.

Configure o tópico **payment** no painel do Mercado Pago, URL HTTPS `/api/webhooks/mercadopago`, com o mesmo segredo de validação. O provedor envia `data.id` na query e a aplicação exige que coincida com o corpo assinado. Um simulador sem assinatura válida deve ser recusado; isso não é evidência de falha do mecanismo. Use as credenciais apropriadas à configuração de teste do painel.

Execute e registre esta matriz no ambiente HTTPS de sandbox:

- Cartão aprovado: pedido persistido, valor 10, moeda BRL, modo de teste e conta corretos; download corresponde ao SHA do manifesto.
- Cartão recusado: instrução clara, nenhuma liberação; nova tentativa usa outra chave.
- Pix pendente, quando disponibilizado pela conta: Status Screen apresenta as instruções; consulta manual não libera antes da aprovação; notificação aprovada libera.
- Clique duplo/reenvio da mesma tentativa: uma compra no provedor e um evento de aprovação no D1.
- Resposta perdida/recarregamento: cookie recupera o pedido; pesquisa por referência externa não cria outro pagamento.
- Webhook real assinado, repetido e fora de ordem: um evento de compra; estado mais novo prevalece. Assinatura/ID alterado e callback do navegador não concedem acesso.
- Cookie ausente ou de outro pedido: sem download. Estorno/contestação: acesso revogado.
- Conferir tipos de pagamento retornados pela conta real e requisitos dos dados no Brick. Testes locais com doubles não comprovam isso.

Fontes oficiais: [Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/default-rendering), [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks), [Compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-test/test-payment).

## Build e preview do Worker

```sh
npm run cloudflare:build
npx wrangler deploy --dry-run --outdir work/worker-dry-run
node scripts/cloudflare-ebook.mjs
npx wrangler d1 migrations apply receitas-premium-150-orders --local
npm run cloudflare:preview
```

Sem credenciais, mantenha `CHECKOUT_ENABLED=false` inclusive no preview. O build remove valores privados do módulo de ambiente emitido pelo OpenNext. A checagem rejeita PDFs nos assets públicos. O PDF também é excluído do rastreamento de arquivos do Next e não precisa ser carregado em memória no Worker; R2 é transmitido por streaming.

## Ativar produção depois de validar o sandbox

Registre o resultado da matriz acima e configure credenciais de produção correspondentes, conta recebedora, webhook e `SITE_URL`. Só então ajuste `MERCADOPAGO_MODE=production`, `LIVE_PAYMENTS_ENABLED=true` e `CHECKOUT_ENABLED=true`. O código rejeita pagamentos cujo `live_mode` diverge do modo configurado. O site não muda esses flags automaticamente.

`npm run cloudflare:deploy` só deve ser executado após o build, os bindings e os testes oficiais. Confira o download autorizado e os eventos reais sem dados pessoais. Mantenha segredos em bindings do Worker; nunca em arquivos públicos, Git, argumentos de shell ou eventos.

Em ambiente com configuração de usuário restrita: `XDG_CONFIG_HOME=/workspace/work/cloudflare-config`, `WRANGLER_LOG_PATH=/workspace/work/wrangler-logs`, `WRANGLER_SEND_METRICS=false`. Para npm, `--cache /workspace/work/npm-cache`.
