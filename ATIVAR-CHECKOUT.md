> **Preparação de produção:** consulte [PRODUCAO-META.md](PRODUCAO-META.md). Aplique a migration 0002 antes de publicar esta versão, inclusive em sandbox. O deploy padrão não ativa vendas reais; a produção usa comando separado e credenciais correspondentes. As instruções históricas abaixo sobre bloqueio absoluto de produção são substituídas por esse guia.

> **Atualização Orders:** a integração HTTP foi migrada para Orders, apenas para sandbox. Siga [ORDERS-SANDBOX.md](ORDERS-SANDBOX.md), que substitui as instruções abaixo sobre Payments, tópico `payment`, Status Screen e ativação de produção por flags. Não habilite cobranças reais.

# Ativar o checkout na página

A integração usa o Payment Brick oficial, sem redirecionamento. O backend mantém pedidos no D1, valida webhooks e libera o PDF do R2 privado somente após aprovação confirmada. O preço é R$ 10,00, em BRL.

## 1. Mercado Pago Developers

Em **Suas integrações**, crie ou abra a aplicação da loja. Se o painel perguntar pela solução, escolha **Checkout Bricks / Payment Brick**, para pagamentos dentro do site. Use as credenciais de teste para a primeira validação. A conexão de plugin mostrada no painel é opcional e não configura as credenciais do Worker.

## 2. Cloudflare → Workers & Pages → livro-receitas

Em **Settings → Variables and Secrets**, adicione os valores em modo secreto, sem colocá-los no Git ou no chat:

| Nome | Origem |
| --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN` | Credenciais da aplicação no Mercado Pago |
| `MERCADOPAGO_PUBLIC_KEY` | Public Key da mesma aplicação e ambiente |
| `MERCADOPAGO_COLLECTOR_ID` | ID da conta vendedora correspondente às credenciais |
| `MERCADOPAGO_WEBHOOK_SECRET` | Assinatura secreta de Webhooks |

Configure `SITE_URL=https://livro-receitas.joaolucasqtb.workers.dev` se este continuar sendo o endereço final. Em Webhooks do Mercado Pago, habilite **payment** para `https://livro-receitas.joaolucasqtb.workers.dev/api/webhooks/mercadopago`.

## 3. Pedidos e entrega

Crie ou reutilize o D1 `receitas-premium-150-orders`, preencha o ID real em `wrangler.jsonc` e aplique a migration:

```sh
npx wrangler d1 migrations apply receitas-premium-150-orders --remote
```

O binding é `ORDERS`. O binding R2 é `EBOOKS`, bucket privado `receitas-premium-150-ebooks`. Prepare o PDF conforme CLOUDFLARE.md; o arquivo público de demonstração não substitui o produto privado. Não ative acesso público ao bucket.

## 4. Publicar para testar

No `wrangler.jsonc`, configure `SITE_URL` e as variáveis `CHECKOUT_ENABLED=true`, `MERCADOPAGO_MODE=sandbox`, `LIVE_PAYMENTS_ENABLED=false`. Mantenha os tokens nos segredos do Worker.

Na integração Git do Worker, mantenha o build `npm run cloudflare:build` e **troque o deploy para `npm run cloudflare:deploy`**. O comando `cloudflare:deploy:vitrine` força o pagamento a ficar desativado em todos os deploys, mesmo se você tentar habilitá-lo no painel.

Valide `/api/checkout`: deve responder `available: true` quando configuração, PDF privado e meios de pagamento estiverem disponíveis. Não publique tokens ao compartilhar diagnósticos.

## 5. Testar antes de cobrar

Execute a matriz de sandbox em CLOUDFLARE.md: aprovação, recusa, pendência quando disponível, reenvio, webhook assinado e download autorizado. Os testes automatizados locais não substituem esse teste oficial.

Depois de validar, configure as credenciais de produção correspondentes e mude as variáveis do arquivo para `MERCADOPAGO_MODE=production`, `LIVE_PAYMENTS_ENABLED=true`, `CHECKOUT_ENABLED=true`. Publique novamente. Sem credenciais e teste oficial, o checkout não está pronto para receber pagamentos reais.
