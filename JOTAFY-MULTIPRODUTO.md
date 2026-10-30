# JotaFy — plataforma multi-produto

## Estado em 30/10/2026, publicado em produção

O código multi-produto está publicado em produção desde 30/10/2026, 18:36 UTC. Consulte “Publicação em produção” ao final para versão, commit e verificações pós-deploy. As seções seguintes preservam o registro anterior à publicação.

## Estado antes da publicação do código

Implementação integrada em feat/jotafy-multiproduto, baseada na produção 5fa52f2. Não confundir migration aplicada com código publicado. Consultar o registro de publicação ao final deste arquivo e as versões reais do Cloudflare.

- Migration 0011_jotafy_platform.sql aplicada no D1 autorizado receitas-premium-150-orders, conta 48a86816b0ea33a5e9da7eb156dd98b1. Nenhuma outra migration estava pendente.
- Preservados 44 pedidos: 36 de produção e 8 de sandbox; a view administrativa expõe somente produção. Mapeados os 44 IDs sem reconstruir orders. Preservadas uma conta e duas sessões administrativas. PRAGMA foreign_key_check sem erros.
- Produto migrado: 150 Doces para Comer e Vender, ID/slug 150-doces-comer-vender, R$10,00, BRL, ativo. Arquivo privado, pedidos, acessos e configuração de Pixel existentes preservados.
- Bookmark D1 anterior à migration: 00000077-00000075-00005114-f98d3333e0430e3465968be5f13b7a4e. Não restaurar automaticamente: novas vendas podem ocorrer depois desse ponto.
- PLATFORM_ENCRYPTION_KEY gerada criptograficamente e provisionada somente como Cloudflare Secret; nenhum valor em Git, logs ou chat. Não sobrescrever: protege credenciais futuras.
- Branding público JotaFy. Nomes técnicos históricos de Worker, banco, cookies e rotas permanecem por compatibilidade. O livro é um produto, não o nome da plataforma.

## Entrega implementada

Produtos com ID imutável, slug, descrição, imagem, página de vendas, preço BRL, status, entrega privada/link/manual, instruções, credenciais MP criptografadas, Pixel/CAPI e custos opcionais. Rotas /admin/produtos e /admin/produtos/[id], upload privado limitado a 25 MiB e auditoria com versão otimista.

Checkout independente /checkout/[slug] e incorporado por script /api/embed/[slug]. O checkout antigo diretamente na página do livro continua preservado. O incorporado exige origem HTTPS da página de vendas cadastrada no produto; CSP permite somente essa origem e a própria plataforma. Usa cookie Secure/HttpOnly/SameSite=None/Partitioned e oferece abertura em página separada para navegadores incompatíveis. Uma cobrança já iniciada deve ser consultada antes de outra tentativa. Instrumentação externa /api/track/[slug] restringe CORS à origem configurada.

Pagamentos carregam preço/moeda/produto do banco, persistem pedido/cliente/sessão antes do POST Mercado Pago e usam external_reference produto_pedido_tentativa. Somente resposta autoritativa do provedor confirma venda. Webhook /api/platform/mercadopago/[ID] deve ser configurado nas notificações Orders da aplicação MP usada pelo produto. A conta padrão herdada conserva o webhook anterior e compatibilidade das referências antigas.

Entrega privada vinculada ao snapshot do produto/pedido aprovado, revalidada no provedor. Recuperação por link aleatório com hash no banco, sete dias e revogação efetiva. Produto pausado mantém entrega dos pedidos anteriores. Recuperação do livro antigo permanece nas rotas anteriores, sem recriar links.

Central /admin com produtos, pedidos, pagamentos, clientes, funil, campanhas, Ads, Pixel/CAPI, notificações, saúde e configurações. Filtros, paginação, CSV com proteção de fórmula e detalhes/linha do tempo. Painel anterior em /admin/legado. Login e senha existentes, sessões registradas/revogáveis, proteção de origem e limites preservados. Conta única administrativa; esquema preparado para perfis futuros, sem prometer equipe multiusuário já implementada.

Funil distingue cliques oficiais importados da Meta dos cliques do site. Sessões, UTMs e primeira origem persistidas; visitas por carregamento e ViewContent/InitiateCheckout por sessão. Compra iniciada somente após criação de pagamento. Purchase somente após aprovação segura, event_id compartilhado e Pixel congelado por pedido. Filas internas e Meta separadas, consentimento/GPC respeitados, falha Meta não impede pagamento/entrega. Nenhuma atribuição histórica inventada.

Ads oficial somente leitura: conta, teste, campanhas/conjuntos/anúncios e Insights diários por nível; paginação por cursor, upsert, cobertura por dia e publicação atômica. Associação mais específica anúncio > conjunto > campanha; sem dupla alocação. Sincronização manual com quota e cron horário de uma conta por execução, janela móvel de sete dias. Períodos antigos exigem sincronização manual e dados ainda disponíveis na Meta.

## Serviços e limitações reais

Meta Ads NÃO foi autorizada com uma conta real neste trabalho. Configure em /admin/integracoes/meta, usando campo seguro de token e ID da conta. Requer ads_read e acesso efetivo ao ativo; ativos de terceiros podem exigir Advanced Access e aprovação da Meta. business_management somente se o fluxo de acesso ao negócio/ativos utilizado exigir; não é usado para editar anúncios. Token CAPI não implica autorização Ads. Referência oficial: https://developers.facebook.com/docs/marketing-api/get-started/authorization/ e coleção Meta https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi .

Tokens MP/CAPI por produto são opcionais quando a conta padrão se aplica; configure conta própria com token, public key, collector ID e segredo do webhook coerentes. Tokens nunca retornam à UI. Pixel por produto e CAPI precisam do acesso real correspondente. O Pixel original e a fila legada continuam preservados.

CPA/ROAS exibidos são razões operacionais entre gasto importado e vendas internas, não atribuição oficial da Meta. Lucro exige custos/taxas/despesas preenchidos e gasto importado. Sem fonte, mostrar Sem dados/Não configurado. Janela de atribuição e fuso da conta são registrados; restrições de consentimento, bloqueadores e dados agregados impedem atribuição individual garantida. BRL é a moeda suportada nesta versão.

Saúde separa configuração de observação e sucesso de serviço. FCM aceito não comprova exibição no aparelho; arquivo servido não comprova abertura. Serviço de notificações adaptado a partir do código realmente ativo a6d58cd6, preservando application_id, teste técnico, secrets, cron e APKs; não usar o servidor antigo da branch para sobrescrever a versão ativa. Script scripts/deploy-jotafy-platform.mjs verifica versão anterior, banco, bindings e assets antes/depois.

## Validação concluída

- TypeScript e build Cloudflare/OpenNext com validação do artefato: sem PDF privado e sem variáveis privadas no módulo de ambiente.
- Plataforma: 16 testes com D1/R2 locais e serviços simulados, incluindo migration, isolamento de produtos, preço do banco, reembolsos, webhook assinado, deduplicação, entrega/revogação, cron/filas, privacidade, filtros e Ads paginação/upsert/falha atômica.
- Regressões: comércio 22, recuperação/entrega 18, Meta 17, operações/autenticação 10, credenciais 2 e guards de publicação 4.
- Interface em 360 e 1440px: painel/funil/filtros/CSV, produtos, credencial mascarada, Pix/pós-compra e modo incorporado.
- Artefato Worker real com D1 local: cadastro restrito/login/logout, APIs protegidas, criação/ativação/draft de produto, cookie incorporado, CSP/CORS, painel e produtos nas duas larguras. Script scripts/test-platform-worker.mjs.
- Monitor JotaFy real adaptado: teste local confirma leitura de vendas novas e enfileiramento no protocolo existente, sem push real.
- Simulações de deploy da loja e monitor passaram. Não houve cobrança, pedido fictício ou conversão falsa em produção.

Testes simulados não comprovam recebimento real pela Meta, webhook de nova compra, entrega de venda nova ou exibição FCM. Recuperação autenticada de pedido real requer autorização do proprietário; não usar a senha dele nem emitir link apenas para preencher teste.

## Publicação e permissões

Fluxo principal: npm.cmd run cloudflare:build e npm.cmd run cloudflare:deploy:production, depois conferir versão e tráfego reais. Guardas D1 preservados e ampliados. Identidade deste terminal OAuth com Workers write e D1 write, conta correta. CLOUDFLARE_API_TOKEN de ambiente teria precedência; não presumir que login o substitui.

Workers Builds nativo continua sem diagnóstico de causa: leitura de triggers retorna HTTP403/10000; lista de builds HTTP403/12004 Forbidden. Comando reprodutível local: node work/audit-release.mjs. É necessário acesso de leitura à configuração e aos logs de Workers Builds nessa conta. Não atribuir a falha ao Actions ou ao build sem abrir o log. Actions está condicionado a CLOUDFLARE_ACTIONS_DEPLOY, sem variables/secrets e skipped. Pages separado terminou com sucesso e publica outro destino. Integrações não foram apagadas/desativadas. Revalidar após push para evitar concorrência.

A conta do proprietário já existe: entrar em /admin/entrar com e-mail/senha existentes. Não fazer outro cadastro. Recuperação operacional excepcional permanece via npm.cmd run gestao:configurar e credencial local criptografada, nunca pelo chat.

## Backups e retomada

Tarefa LivroReceitas-Central-Backup5min, a cada cinco minutos, última execução verificada com resultado 0. Destino C:\Users\João\Documents\Backup-livro-receitas-central. Bundle Git, patch, fontes novas, manifesto e PROGRESSO.md; excludes de secrets/PDF/gerados preservados. Consulte latest.json/last-run.json. Restaurar em outra pasta, nunca sobrescrever o checkout original sujo.

Checkout de trabalho: C:\Users\João\Projetos\livro-receitas\work\meta-github-release. Não limpar/resetar o checkout principal nem o antigo C:\Windows\System32\livro-receitas. PROMPT-OPENCODE-JOTAFY.md é contexto histórico; este estado e Git/Cloudflare atuais têm precedência.

## Publicação em produção — 30/10/2026

- Worker livro-receitas publicado com `npm.cmd run cloudflare:deploy:production`, versão b126f9f2-ecf8-4dae-af19-1febd577a0e6, tag 76127b95b633, mensagem livro-receitas 76127b95b633eaa228f1fead282c3aa662438045, 100% do tráfego, 30/10/2026 18:36 UTC. O commit publicado é 76127b9, o mesmo revisado e testado.
- Identidade OAuth joaolucasqtb@gmail.com, conta 48a86816b0ea33a5e9da7eb156dd98b1, com Workers write, D1 write e Workers tail. Nenhum build concorrente entre a revisão e o deploy. D1 remoto sem migrations pendentes antes da publicação.
- Verificação pós-deploy: `/` 200, `/admin` → login (307), `/admin/produtos` → login, `/checkout/150-doces-comer-vender` 200 com R$10 e Pix, `/api/store/150-doces-comer-vender` 200 com amount_cents 1000, status active, entrega file e Pixel legado; `/api/admin/platform`, `/api/admin/operations` e `/api/admin/meta` retornam 401 sem sessão; `/api/embed/150-doces-comer-vender` 200 JavaScript; `/api/platform/mercadopago/150-doces-comer-vender` e `/api/webhooks/mercadopago` aceitam somente POST (405 em GET); CSP frame-ancestors aplicada em `/checkout/...?embed=1`.
- Dados intactos após o deploy: 46 pedidos legados, 1 produto ativo R$10/BRL, 0 platform_orders, 0 tentativas, 0 eventos Meta, 0 grants e 0 sessões novas. Nenhuma cobrança, pedido fictício ou conversão foi gerada durante a publicação ou a verificação.
- Validação executada antes do deploy: typecheck, platform 16/16, commerce 22/22, access 18/18, meta 17/17, operations 10/10, credential 2/2, deploy guards 4/4, platform UI e management UI em 360/1440px, build Cloudflare sem PDF/segredos, Worker local real e Playwright completo 114/114.
- Pendências inalteradas: integração Meta Ads real depende de token/conta do proprietário com ads_read; Workers Builds nativo continua sem acesso de leitura (403/12004 e 403/10000); webhook de nova compra, entrega de venda nova e exibição FCM só podem ser comprovados com uma venda real autorizada.
