# JotaFy — catálogo real e Meta Ads

## O que foi implementado
- `GET/POST /api/admin/products`: criação de rascunhos e edição de registros persistidos em D1, autenticação de administrador, verificação de origem, rate limit, controle de versão e auditoria.
- Produto em produção `150-doces-comer-vender`: pode editar nome, descrição e imagem do **cadastro administrativo**. Preço e cobrança reais continuam protegidos pelo checkout existente e NÃO são alterados por esse módulo.
- Produtos novos ficam em estado **rascunho**. É possível registrar nome, preço, descrição e imagem local; NÃO há publicação automática, checkout nem entrega de novos produtos antes de implementação adicional.
- `GET /api/admin/meta-ads/connect`: autorização oficial do Facebook, permissões `ads_read`, `ads_management`.
- `GET /api/admin/meta-ads/callback`: validação OAuth por state e sessão administrativa, troca para token de longa duração, criptografia AES-GCM no D1.
- `GET /api/admin/meta-ads`: contas autorizadas, campanha/conjunto/anúncio, gastos, impressões, cliques totais, cliques no link, cliques de saída e visualizações da página de destino; períodos até 93 dias.
- `POST /api/admin/meta-ads`: selecionar conta, desconectar e ativar/pausar **campanhas e conjuntos** após confirmação explícita. Não altera orçamento, público, criativo ou faturamento.
- Nenhum token enviado à interface ou salvo em cookies/client-side.

## Pré-requisitos obrigatórios para habilitar a integração
1. Fazer backup do banco D1 e aplicar a migração aditiva `0011_catalog_meta_ads.sql` **antes** de qualquer deploy da nova versão, para a mesma conta Cloudflare e o mesmo banco de produção:
   ```sh
   npx wrangler d1 migrations apply receitas-premium-150-orders --remote
   ```
   Confira o histórico de migrações e tabelas. Nenhuma tabela anterior é alterada.
2. Criar ou selecionar um **Meta App** associado ao negócio correto em [developers.facebook.com/apps](https://developers.facebook.com/apps/). Configurar o login Facebook para o aplicativo e permitir exatamente o URI HTTPS:
   `https://livro-receitas.joaolucasqtb.workers.dev/api/admin/meta-ads/callback`
3. Configurar os **Secrets** do Worker (não como variáveis públicas e nunca no GitHub):
   ```sh
   npx wrangler secret put META_ADS_APP_ID
   npx wrangler secret put META_ADS_APP_SECRET
   npx wrangler secret put META_ADS_ENCRYPTION_KEY
   ```
   Para a chave de criptografia: usar 32 bytes criptograficamente aleatórios em hexadecimal (64 caracteres). Exemplo de geração local: `openssl rand -hex 32`.
4. Garantir acesso do Meta App/usuário à conta de anúncios. A Meta pode exigir App Review e Advanced Access para contas de terceiros. O aplicativo solicita `ads_read` e `ads_management`.
5. No painel administrativo, abrir **Meta Ads → Conectar com Facebook** e selecionar a conta; nenhuma credencial de Facebook é digitada no JotaFy.
6. Confirmar em produção que o token autorizado pode consultar insights e, separadamente, testar alteração do status de uma campanha de teste.

## Limitações deliberadas
- Relatórios da Meta dependem da própria regra de atribuição e não correspondem necessariamente aos eventos próprios do JotaFy. Nunca inferir que a diferença cliques–LPV seja abandono real.
- Os totais exibidos somam as linhas da resposta; a API limita a primeira página a 100 registros, com aviso explícito quando esse limite é alcançado. Não usar o painel como relatório completo em contas muito grandes sem implementar paginação.
- Nenhum botão de publicação de produto novo está disponível enquanto checkout, webhook, validação de preço, estoque/entrega e download forem exclusivos do e-book original.
- O preço do produto vendido é protegido no backend. Alterá-lo isoladamente quebraria a integridade de pagamentos existentes.
- Não há importação retrospectiva dos pedidos Meta nem alteração da CAPI de compras.
- Guardar a chave `META_ADS_ENCRYPTION_KEY` de forma durável. Sua perda impedirá descriptografar o token salvo.
- Tokens de usuários expiram ou podem ser revogados. Reconectar via OAuth quando necessário.

## Verificação local/CI
```sh
npm ci
npm run typecheck
npm run test:commerce
npm run test:access
npm run test:meta
npm run test:operations
node scripts/test-catalog-meta.mjs
npm run build
npx playwright install chromium
npm run test:management:ui
```
Os testes de navegador usam fixtures, nunca contas Meta reais.

## Publicação
**Não fazer merge nem deploy sem preparar migração, revisão das permissões do aplicativo e autorização explícita.**
O deploy controlado deve testar as novas tabelas após a migration e preservar os secrets existentes do Worker com `--keep-vars`.
