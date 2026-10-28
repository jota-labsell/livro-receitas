# Auditoria de pendências — 28/10/2026

## Projetos separados: não misturar provedores

- **doce-no-lucro** é o sistema de precificação para confeiteiras: React/Vite e **Supabase** (Auth, PostgreSQL, Storage), não Firebase. Seu README informa que ainda não há cobrança integrada. Não substituir Supabase por Firebase sem migração planejada.
- **livro-receitas** é a página do e-book de R$ 10: Next.js, Cloudflare Worker, D1/R2, Mercado Pago e Pixel da Meta. O checkout, a medição e a preferência de privacidade deste relatório pertencem a este segundo repositório.

## Alterações propostas nesta branch

1. O Payment Brick agora ignora erros **não críticos** do SDK durante a digitação (como validações transitórias de cartão/BIN) e mostra um erro de recuperação apenas em falhas críticas. O log contém somente um código de causa validado, sem números de cartão ou dados do formulário. Isso evita mensagens falsas de pagamento recusado; **não comprova que a origem da falha de digitação esteja resolvida**. Testar no SDK real, em celular e desktop, antes de publicar.
2. A página mantém somente um botão discreto **Preferências de privacidade**, sem modal obrigatório de cookies. O cookie de pedido é estritamente funcional e continua necessário. O Pixel depende de permissão explícita. Os testes de interface foram alinhados ao botão atual.
3. Foi preparada a rota **POST /api/meta/purchase** para enviar um Purchase por Conversions API, opcional e desligado por padrão. O backend reconfirma o pagamento de produção no Mercado Pago e exige consentimento persistido no pedido. O identificador de evento é idêntico ao Purchase do Pixel, para deduplicação. A tabela D1 controla tentativas e não reenvia eventos já confirmados. Sem dados de cartão, nome ou e-mail.

## Antes de qualquer publicação

**Não publicar esta branch diretamente sem validar a suíte e aplicar a migration.** Ela altera o banco e o fluxo de consentimento. A migration é aditiva, mas só pode ser executada uma vez por ambiente:

```sh
npm ci
npm run typecheck
npm run test:commerce
npm run test:ui
npm run cloudflare:build
npx wrangler d1 migrations apply receitas-premium-150-orders --remote
```

A migration `0004_meta_capi.sql` adiciona `orders.meta_consent` e a tabela `meta_purchase_delivery`. Aplicar antes de habilitar a API de Conversões. Os comandos acima são **instruções**, não execução confirmada nesta auditoria.

Para ativar depois de testar, configurar no Worker `livro-receitas`:

- Secret `META_CAPI_ACCESS_TOKEN`: token de Conversions API gerado no Gerenciador de Eventos do Pixel `1150409944170993`. Nunca colocar em Git, `NEXT_PUBLIC_*` ou `wrangler.jsonc`.
- Secret/variável protegida `META_CAPI_ENABLED=true`: ativação explícita. Ausente ou diferente de `true` mantém a rota desabilitada.
- Preservar `MERCADOPAGO_MODE=production`, `LIVE_PAYMENTS_ENABLED=true`, `CHECKOUT_ENABLED=true`, `SITE_URL` e as credenciais já existentes, sem sobrescrevê-las com sandbox.

Exemplo para o terminal **autenticado do responsável**:

```sh
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put META_CAPI_ENABLED
```

O segundo comando solicita digitar `true`. Verificar o Worker de destino antes de executar. Não foi possível configurar esses secrets a partir da conexão GitHub; **a branch não ativa a API de Conversões nem publica o Worker**.

## Testes obrigatórios em produção

1. Validar que `GET /api/checkout` continua `available:true`, `mode:production` e valor R$ 10. Não enviar números de cartão a logs ou suporte. Testar a digitação no campo seguro do SDK oficial, observar causas de falha críticas sem expor PII e conferir o fluxo de cartão com meio legítimo autorizado.
2. Confirmar que recusar medição não carrega Pixel e não gera linha de CAPI. Permitir medição antes da compra e conferir `orders.meta_consent=1` no D1, sem divulgar identificadores pessoais. A mudança da preferência deve ser possível sem interromper Pix ou cartão.
3. Com **uma compra real expressamente autorizada**, conferir pagamento no Mercado Pago, webhook assinado, download privado e um `purchase_approved` no D1. Nunca criar cobrança real apenas para fabricar uma conversão.
4. Conferir no Gerenciador de Eventos que o mesmo `event_id` aparece no Purchase do navegador e no Purchase do servidor, com valor 10.00 e moeda BRL, e que foi deduplicado. Sem acesso autenticado ao Gerenciador, não afirmar recebimento.
5. Consultar apenas estados de entrega no D1:

```sql
SELECT state, COUNT(*) AS total FROM meta_purchase_delivery GROUP BY state;
```

A entrega via CAPI nesta versão é **acionada pelo navegador após compra aprovada**; se a pessoa fechar a página antes da confirmação, o servidor não envia automaticamente. A tabela impede duplicidade em tentativas repetidas, mas não substitui fila com retries agendados. Os eventos são limitados a 48 horas após a aprovação para evitar deduplicação tardia. Qualidade de correspondência pode ser baixa sem identificadores adicionais, que exigiriam revisão de privacidade e consentimento.

## Limitações de acesso desta auditoria

A conexão GitHub permite leitura e commits, mas não fornece por si só acesso ao painel Cloudflare, banco D1 remoto, Mercado Pago, Meta Events Manager ou sessão Codex do notebook. Portanto não houve leitura de secrets, alteração de credenciais, execução de cobrança, publicação em produção ou teste real de campo de cartão. Uma PR isolada é mais segura que alterar diretamente a branch de produção sem validar.
