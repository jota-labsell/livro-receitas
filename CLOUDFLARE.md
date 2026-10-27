# Workers + OpenNext + D1 + R2 privado

## Ativar o checkout incorporado à página (Mercado Pago Payment Brick)

O formulário já é exibido dentro de `#checkout` por `components/checkout.tsx`, sem redirecionar o comprador. **O deploy `cloudflare:deploy:vitrine` sempre desliga o checkout**. Não é possível habilitá-lo somente trocando o botão ou adicionando a chave pública.

**1. Cloudflare D1:** criar ou localizar `receitas-premium-150-orders`; colocar o ID real em `wrangler.jsonc`, binding `ORDERS`, e aplicar `npx wrangler d1 migrations apply receitas-premium-150-orders --remote`.

**2. Cloudflare R2:** criar ou localizar o bucket privado `receitas-premium-150-ebooks`, confirmar binding `EBOOKS`, desabilitar acesso público e enviar a edição autêntica do PDF por `node scripts/cloudflare-ebook.mjs --remote` conforme instruções abaixo. O endpoint `/api/checkout` só disponibiliza a compra quando o arquivo existe.

**3. Segredos no Worker, nunca no Git:** configurar `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET` e `MERCADOPAGO_COLLECTOR_ID` da mesma conta e do mesmo ambiente. Configurar `SITE_URL` como origem HTTPS pública do Worker. Guardar chaves privadas via painel Cloudflare (Settings → Variables and Secrets) ou `wrangler secret put` em terminal autenticado. Não informar tokens em chats ou arquivos de código.

**4. Webhook:** cadastrar evento `payment` na conta Mercado Pago, destino `https://SEU-DOMINIO/api/webhooks/mercadopago`, usando o segredo de assinatura correspondente.

**5. Primeiro validar no sandbox:** `MERCADOPAGO_MODE=sandbox`, `CHECKOUT_ENABLED=true`, `LIVE_PAYMENTS_ENABLED=false`. Compilar com `npm run cloudflare:build` e testar a matriz de pagamentos e entrega abaixo; monitorar `GET /api/checkout` (deve retornar `available: true` somente quando pronto). Não há compra real neste modo.

**6. Somente após validar:** configurar credenciais *de produção* e os três flags `MERCADOPAGO_MODE=production`, `CHECKOUT_ENABLED=true`, `LIVE_PAYMENTS_ENABLED=true`, conferir domínio, D1/R2, webhook e conta recebedora. Publicar o Worker pelo deploy completo `npm run cloudflare:deploy`, **não** pelo comando `cloudflare:deploy:vitrine`. Nunca ativar cobranças reais sem testar a entrega do PDF e o fluxo de estorno.

O valor é determinado no servidor por `lib/product.config.ts` e deve corresponder aos R$ 10,00 exibidos na página. Não mudar somente a interface do Brick para alterar preços.


## Bloqueios observados

Credenciais do Mercado Pago ausentes. O token Cloudflare configurado não conseguiu listar D1 (erro de autenticação 10000). A integração do pagamento está implementada, mas o checkout continua desativado e o ID do D1 ainda precisa ser preenchido. Não envie tokens pelo chat. Ajuste permissões no gerenciador seguro da conta/ambiente: Workers Scripts, R2 Storage e D1, para a conta correta.

## Publicar a vitrine enquanto D1 e Mercado Pago estão pendentes

Este projeto é um **Worker com OpenNext**, não uma aplicação estática do Pages. Um deploy verde em `pages.dev` não executa o servidor Next.js. Use o endereço `workers.dev` retornado pelo deploy.

```sh
npm run cloudflare:build
npm run cloudflare:deploy:vitrine -- --dry-run
npm run cloudflare:deploy:vitrine
```

O último comando publica a vitrine no Worker `livro-receitas`, com o mesmo nome mostrado na tela de criação da Cloudflare. Ele gera uma configuração local ignorada pelo Git que omite o D1 e força `CHECKOUT_ENABLED=false` e `LIVE_PAYMENTS_ENABLED=false`. O R2 continua privado e as páginas reais do livro são demonstradas. Nenhum pagamento ou download completo é liberado. Eventos estão preparados no código, mas não são persistidos neste modo sem D1.

Na tela **Set up your application** de Workers, preencha:

| Campo | Valor |
| --- | --- |
| Project name | `livro-receitas` |
| Build command | `npm run cloudflare:build` |
| Deploy command | `npm run cloudflare:deploy:vitrine` |

Essa tela pode não exibir seletor de branch. A branch padrão do GitHub já é `feat/150-doces-r10`, confirmada pela API do repositório. Mantenha o campo Preview command como está e clique no botão azul **Deploy**, no canto inferior direito. No fluxo de **Pages** não existe o mesmo campo Deploy command; para este projeto, continue no fluxo de **Workers** mostrado acima. O projeto Pages anterior pode permanecer enquanto o Worker é validado. O aviso de conta Git desconectada deve ser resolvido na integração Git da Cloudflare para futuros deploys automáticos; ele não impede publicação pela CLI autenticada.

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
