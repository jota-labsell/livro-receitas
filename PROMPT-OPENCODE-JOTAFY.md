# Prompt de continuidade para OpenCode — Jotafy multi-produto

Você vai CONTINUAR uma implementação existente. Não comece do zero. Execute implementação, revisão, testes e, somente quando tudo estiver validado e autorizado, publicação. Preserve a produção e todo o trabalho local. Não entregue apenas um plano e não declare concluído o que não foi testado.

## Primeiro passo: localizar e preservar o trabalho

O computador é Windows, terminal PowerShell. O checkout correto é:

```powershell
Set-Location 'C:\Users\João\Projetos\livro-receitas\work\meta-github-release'
git status --short --branch
git log -5 --oneline
```

Branch de implementação: `feat/jotafy-multiproduto`. HEAD de partida: `5fa52f2a8f8bc378143f46547982c297d7f8fe34`, baseado em `origin/feat/150-doces-r10`. A maior parte da implementação nova AINDA ESTÁ EM ARQUIVOS MODIFICADOS/NÃO RASTREADOS. Fazer clone apenas do GitHub NÃO recupera esse trabalho. Não dar checkout/reset/clean/stash indiscriminadamente.

O projeto principal `C:\Users\João\Projetos\livro-receitas` contém muitas alterações anteriores e não pode ser sobrescrito. A cópia `C:\Windows\System32\livro-receitas` é antiga; não é a implementação atual.

Não edite o mesmo checkout simultaneamente com outro agente. Confira com o proprietário quem está com a execução. Para trabalhar em paralelo, faça uma cópia isolada recuperada do backup (bundle + patch + untracked), use branch própria e integre de forma revisada depois. Não mate processos de outro agente nem publique uma cópia atrasada.

Leia, nesta ordem:

1. `AGENTS.md` e instruções aplicáveis nos subdiretórios.
2. `JOTAFY-MULTIPRODUTO.md` — andamento, decisões e pendências da implementação atual.
3. `CENTRAL-GESTAO.md`, `PAINEL-OPERACAO-DARK.md`, `RETOMADA-CENTRAL-GESTAO.md`.
4. `GITHUB-CLOUDFLARE.md`, documentação de pagamentos/entrega/Meta do projeto, conferindo o código atual porque alguns documentos descrevem etapas antigas.

## Objetivo funcional completo

Transformar a Jotafy numa plataforma de gestão e venda de vários produtos na mesma conta. Cada produto precisa de identificação imutável, nome/slug/descrição/capa/URL, preço/moeda/status, credenciais Mercado Pago, Pixel/CAPI, associação Meta Ads, entrega e custos próprios.

- Produtos: cadastro/edição/rascunho/ativo/pausado/arquivado; rascunho privado; pausado sem novos pagamentos. Rotas `/admin/produtos`, `/admin/produtos/[id]`, `/checkout/[slug]`.
- Pagamentos: produto/preço/moeda vêm do banco; persistir pedido/cliente/sessão/origem antes de criar pagamento; referência externa com produto/pedido/tentativa, idempotência e confirmação autoritativa por MP. Preservar cartão e Pix. Reembolso e chargeback revogam acesso. Não confiar em aprovação do navegador.
- Meta Ads oficial: integração administrativa segura, token somente no backend, conta/Pixel/janela; importar campanhas/conjuntos/anúncios e métricas diárias com paginação/upsert, sincronização manual e cron. Gasto, impressões, alcance, frequência, cliques no link, CTR/CPC/CPM. Produto recebe gasto somente por associação explícita; sem rateio inventado.
- Funil persistido: cliques oficiais Meta Ads → visitas reais → ViewContent → InitiateCheckout → pagamento criado com sucesso → aprovação segura. Capturar primeira origem, UTMs, fbclid/fbc/fbp, campanha/conjunto/anúncio, produto e sessão, respeitando recusa/GPC. Não chamar CTA do site de clique oficial da Meta.
- Pixel/CAPI por produto: PageView, ViewContent, InitiateCheckout, Purchase; browser e servidor com event_id consistente. Purchase só após pagamento confirmado; destino original preservado no pedido. Eventos internos e fila Meta separados. Falha Meta não bloqueia venda/entrega.
- Painel profissional responsivo: Resumo, Produtos, Pedidos, Pagamentos, Clientes, Funil, Campanhas, Meta Ads, Pixel/CAPI, Notificações, Saúde, Configurações. Filtros por período/produto/status/método/fonte/UTM/campanha/conjunto/anúncio/Pixel, paginação/busca/CSV seguro; detalhes do pedido com linha do tempo, tentativas, eventos, recuperação e downloads.
- Indicadores: receita/vendas/pendências/reembolsos/chargebacks/ticket/aprovação/gasto/CPA/ROAS/lucro. Sem dados/custos/permissões: mostrar indisponibilidade, nunca inventar números. Distinguir custo/taxa configurados de taxa efetivamente importada, e ROAS operacional de atribuição oficial Meta.
- Entrega: arquivo privado específico comprado, acesso temporário revogável e revalidação; link externo/manual somente após aprovação; tela pós-compra dominante com CTA claro. Manter o e-book antigo funcionando.
- Saúde: diagnóstico de Ads/Pixel/CAPI/webhook/cron/filas/pendências/entrega/atribuição/downloads/FCM. Alertas honestos e seguros. Credencial existente não significa serviço disponível; evento aceito não significa atribuído; FCM aceito não significa exibido.
- Segurança: login atual preservado; APIs e páginas protegidas; auditoria; esquema para perfis futuros. Sem cadastro público ou senha padrão.

## Stack e particularidades

- TypeScript, TSX/React, Next.js App Router, CSS Modules.
- Versões do projeto: Next 16.4.3, React 19.3.1, TypeScript 7, Node 24. Confirme package-lock.json antes de instalar/alterar versões.
- Next desta versão possui mudanças: leia as instruções locais em `node_modules/next/dist/docs/`. Params/cookies de rotas/páginas são assíncronos.
- Deploy: OpenNext Cloudflare, Wrangler, Worker `worker.ts`, D1 SQLite, R2 privado, cron.
- Testes: node:test, esbuild, Miniflare/D1/R2 locais, Playwright com Chrome no Windows.
- Notificações existentes: código JavaScript em `jotafy/server`, Android em Java/Gradle em `jotafy/android`. Investigue a versão efetivamente publicada do servidor; não presuma que toda alteração Android seja necessária. A integração de novos pedidos ao monitor/push precisa ser validada.
- No PowerShell, usar `npm.cmd`; `npm` pode acionar npm.ps1 bloqueado. CLIs locais são executados com Node para evitar problemas de shims e caminhos com João/espaços.

## Arquitetura já implementada — não substituir sem investigar

A tabela legada `orders` tem `CHECK(amount_cents=1000)`, muitas FKs, cookies e links de acesso. Para preservar esse histórico, foi criada uma migration ADITIVA, sem reconstrução/drop de tabelas:

- `migrations/0011_jotafy_platform.sql` cria `platform_*`, catálogo e livro novo de pedidos/tentativas, sessões/eventos, fila Meta, Ads, cobertura por data, entregas, auditoria/saúde.
- `platform_all_orders` unifica o legado e os novos pedidos sem duplicar vendas. `platform_legacy_products` vincula os IDs existentes ao produto original. `platform_all_sessions` foi preparado para coortes; revisar sua integração com o relatório.
- Produto original: `150-doces-comer-vender`, “150 Doces para Comer e Vender”, R$10/BRL. Original continua com suas tabelas, pagamentos, acessos e PDF; checkout dinâmico usa snapshots independentes para novos produtos.
- Há coluna adicional de external_reference nas tentativas antigas. O comportamento novo é condicionado a `JOTAFY_PLATFORM_ENABLED=true`, preservando referências já existentes. Revisar todos os caminhos de charge/reconcile/search antes de ativar.
- Tokens de produtos e Ads são cifrados com AES-256-GCM, AAD por produto/integração; chave `PLATFORM_ENCRYPTION_KEY` de 32 bytes em hexadecimal nos Cloudflare Secrets. Não sobrescrever uma chave existente: isso inutilizaria os dados cifrados sem recifragem.
- Arquivos novos: `lib/platform-*.ts`, `components/platform-*.tsx`, `components/platform.module.css`, rotas `app/api/admin/platform`, `app/api/store`, `app/api/platform`, `app/checkout`, `app/entrega`, páginas administrativas novas.
- Nova central em `/admin`; antiga preservada em `/admin/legado`. Não perder Minha conta, revogação global após senha, cookies Secure/HttpOnly/Strict e controles de origem/cotas existentes.
- Orders MP não expõe notification_url no contrato oficial consultado. Não adicionar parâmetro não suportado. Foi criado webhook estável por produto `/api/platform/mercadopago/[product]`, a configurar no aplicativo oficial MP; manter também compatibilidade do webhook antigo.

## Estado de testes e revisão

Última execução observada antes deste prompt: `npm.cmd run typecheck` PASSOU e `node scripts/test-platform.mjs` PASSOU com 11 testes.

Os testes cobrem localmente migração/legado, produto/criptografia/concorrência, origem/deduplicação, preço do banco/concorrência de pagamentos, validação MP/reembolso fora de ordem, entrega isolada/revogação, CAPI por produto, pausa/arquivamento, proteção administrativa, filtros e paginação/upsert Ads com falha sem publicar métricas parciais.

Serviços externos são simulados nos testes. Isso NÃO comprova conta Ads autorizada, nova venda real, recebimento pela Meta, webhook real ou exibição FCM. Ainda faltam testes novos de UI, artefato Cloudflare da plataforma e regressão completa. Não usar os resultados da publicação anterior como validação desta implementação.

## Pendências prioritárias

1. Revisar o código existente em vez de apenas acrescentar mais telas. Corrigir quaisquer erros TypeScript/SQL/fluxo e adicionar testes que provem o comportamento requerido.
2. Finalizar `platform-report`: cobertura das datas sincronizadas Ads deve impedir gasto zero falso fora do período importado; associação efetiva deve dar prioridade ad > adset > campaign, sem dupla alocação; agregados financeiros não podem depender de lista truncada. A nova `platform-ads-report.ts` começou a resolver isso; testar os casos de vazio, cobertura parcial e sobreposição.
3. Completar a ponte de tracking do site atual: preservar origem histórica, UTMs e eventos do legado, sem duplicar Pixel/CAPI. Integrar coortes com a view de sessões e não inventar visitas antigas que nunca foram medidas. Novo checkout já registra eventos, mas a landing antiga ainda precisa de revisão de instrumentação.
4. Revisar compatibilidade do produto original: oferta de R$10 vs preço do banco, novas referências externas e antigas, webhook antes de persistir provider_id, pausa, troca de Pixel/CAPI nos dois painéis, mesmos pedidos/acessos/downloads. Não redirecionar ou recriar compras antigas inadvertidamente.
5. Testar delivery externo/manual, refund/chargeback depois da emissão de links, indisponibilidade de R2, cookies copiados/revogados, ausência de consentimento e destino original após troca de Pixel.
6. Finalizar os alertas de saúde e compatibilidade com filas opcionais; investigar como o monitor Jotafy/FCM agrega o novo livro de pedidos. Não afirmar notificação exibida sem telemetria real.
7. Testar UI 360px/1440px: produtos, filtros/CSV, integrações, tokens nunca renderizados, Pix/cartão, pós-compra e erros. Validar o Worker real LOCAL com migration 0011 e fixtures; não apontar teste de escrita/fixtures à produção.
8. Adicionar scripts novos ao package.json/workflow pertinente e ampliar guards do deploy conforme schema real. `wrangler.jsonc` ainda não ativa JOTAFY_PLATFORM_ENABLED. Não ativar antes da migration e validação. Atualizar testes de guards se as vars mudarem, sem enfraquecê-los.
9. Provisionar/verificar a chave de criptografia de modo seguro, sem log/Git/chat; demais tokens serão configurados pelo proprietário no painel. Atualmente não foi fornecido token Ads/conta Ads.
10. Só com tudo validado: nova leitura de remotos e produção, migração autorizada do D1, commit/push/deploy e verificação externa. Registrar limitações reais sem anunciar plataforma completamente operacional se uma parte não passou.

## Acessos necessários e como conferir

### Filesystem e ferramentas

Precisa de acesso de leitura/escrita ao checkout acima e à pasta de backup, Git, Node/npm, rede para GitHub/Cloudflare/Meta/Mercado Pago e Chrome/Playwright. Instalar dependências pelo lockfile quando necessário; não substituir versões arbitrariamente. Não instalar ou publicar código global sem necessidade.

### GitHub

Repositório `https://github.com/jota-labsell/livro-receitas.git`. Precisa de leitura das branches e permissão de push na branch de implementação e depois na fonte de produção autorizada. A autenticação Git do Windows já funcionou. Não imprimir `git credential fill`, tokens ou arquivos de credenciais. Buscar remotos e integrar produção mais recente, sem force push ou sobrescrever melhorias.

### Cloudflare

- Conta esperada: `48a86816b0ea33a5e9da7eb156dd98b1`, proprietário `joaolucasqtb@gmail.com`.
- Worker: `livro-receitas`, URL `https://livro-receitas.joaolucasqtb.workers.dev`.
- D1: `receitas-premium-150-orders`, ID `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`.
- R2 privado: `receitas-premium-150-ebooks`.
- Última versão publicada verificada na entrega ANTERIOR: `560a2b54-488f-4770-a862-4280ac48db46`, código `8d675e7`, 100% do tráfego. Reconsultar; não presumir que continue sendo a ativa.
- OAuth do Wrangler já tinha Workers write e D1 write nesta conta. Identidade pode expirar; verificar novamente. `CLOUDFLARE_API_TOKEN` de ambiente tem precedência e wrangler login não o substitui. Nunca exibir o valor.
- Para publicar: Workers Scripts Edit, consulta/gestão D1 (D1 Edit para migrations), acesso ao R2 necessário às operações de arquivo e ao secret store do Worker para provisionar a chave. Preferir a identidade existente autorizada; não trocar conta/recurso silenciosamente.
- API nativa Workers Builds exigiu permissão separada: Workers Builds Configuration: Edit, ou Workers CI Read/Write conforme endpoint. O OAuth disponível retornou 403/12004 nos logs/lista e 403/10000 na configuração. Isso não prova causa de build falho. Não apagar integração ou desativar guardas para ocultar erro.
- GitHub Actions estava sem secrets e sem ativação, job skipped. Pages e Workers Builds são pipelines independentes. Verificar builds concorrentes antes/depois de publicar; alteração de Actions não corrige automaticamente Workers Builds.

Comandos de leitura:

```powershell
Get-ChildItem Env:CLOUDFLARE* | Select-Object Name
node node_modules/wrangler/bin/wrangler.js whoami
node node_modules/wrangler/bin/wrangler.js deployments list
node node_modules/wrangler/bin/wrangler.js d1 migrations list receitas-premium-150-orders --remote
```

Se aparecer 7403/403, não pular o banco. Registrar o comando, o erro e a permissão ausente. Helpers locais em work podem ler OAuth antigo sem renová-lo; preferir Wrangler para renovar e validar a identidade, sem imprimir credencial.

### Mercado Pago

Credenciais atuais permanecem no Worker: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_WEBHOOK_SECRET, MERCADOPAGO_COLLECTOR_ID, modo/flags. Não pedir que o usuário as envie no chat. Produtos podem compartilhar a conta padrão ou ter credenciais cifradas próprias. Cada aplicação precisa de assinatura/webhook correto e vendedor alinhado.

Não realizar cobrança, aprovação falsa, reembolso financeiro ou compra fictícia em produção. Usar mocks/sandbox apropriados e documentação oficial; GETs seguros podem validar disponibilidade/identidade. Manter cartão, Pix, webhook e downloads atuais.

### Meta

Token Ads e Ad Account ID precisam ser configurados pelo proprietário com autorização ao ativo. Para leitura de relatórios: ads_read; ads_management só se efetivamente necessário por capacidade autorizada. business_management pode ser necessário para descoberta/gestão de ativos, mas não presumir que seja obrigatório para todo GET direto. Acesso de terceiros pode exigir Advanced Access/revisão do app. Consultar a documentação oficial atual.

O token CAPI precisa de acesso real ao Pixel/conjunto de dados do produto. Não presumir que o token atual tenha acesso à conta Ads ou a novos Pixels. Não enviar eventos fictícios à Meta para preencher painéis. Nenhuma campanha/gasto deve ser criada ou ativada nesta tarefa.

### Administração Jotafy

Preservar a conta do proprietário. Nenhuma senha padrão, cadastro público ou pedido de senha/token pelo chat. Existe uma conta real e sessões; não recriar. Para preparar acesso operacional pelo usuário em terminal interativo, o script `npm.cmd run gestao:configurar` usa a credencial local cifrada e sua senha de proteção; não usar isso para extrair ou exibir o segredo.

## Validações e publicação

Primeiro comandos LOCAIS de leitura/teste (o script novo pode ainda não estar no package.json):

```powershell
npm.cmd run typecheck
node scripts/test-platform.mjs
npm.cmd run test:commerce
npm.cmd run test:access
npm.cmd run test:meta
npm.cmd run test:operations
npm.cmd run test:access:credential
node --test scripts/test-deploy-guards.mjs
npm.cmd run test:management:ui
```

Criar/rodar os testes UI e do Worker da plataforma nova, não somente os do painel antigo. Depois:

```powershell
npm.cmd run cloudflare:build
npm.cmd run cloudflare:deploy:production -- --dry-run
```

`npm ci --dry-run` não é uma instalação limpa; se houver dúvida de dependência, validar corretamente o lockfile e ambiente. Build não comprova serviço externo.

Para migration remota, confirmar primeiro conta/banco/histórico e revisar TODAS as pendentes. Só aplicar as necessárias, mantendo histórico. A migration 0011 é nova e ainda não foi aplicada nesta implementação. Não recriar banco, apagar pedidos/tabelas ou ignorar constraints. Preparar verificação de recuperação/Time Travel e métricas antes/depois. Não rodar migrations de teste sobre D1 remoto.

Depois de passar tudo, autorização para commit/push/publicação faz parte do pedido do proprietário. Use o fluxo de produção existente com os novos guards completos. Não publicar uma branch antiga sobre a fonte atual. Confirmar no Cloudflare version ID, commit/tag e 100% do tráfego, depois testar as rotas públicas e protegidas e o checkout original de R$10 sem criar pagamento.

Relatório final obrigatório: branch/commit/URL/version ID, migrations, produto migrado, variáveis/secrets necessários, permissões Meta, testes/resultados/limitações, funcionalidades operacionais e configuração externa ainda pendente. Não declarar Meta autorizada, webhook real ou notificação entregue com base só em testes simulados.

## Backups a cada 5 minutos

Tarefa Windows: `LivroReceitas-Central-Backup5min`. A tarefa antiga de 10 minutos foi desativada, não apagada. Última execução verificada: resultado 0. Roda na sessão do usuário e retoma após entrar no Windows; não roda com notebook desligado.

Pasta: `C:\Users\João\Documents\Backup-livro-receitas-central`.

```powershell
node scripts/backup-progress.mjs
Get-ScheduledTaskInfo -TaskName 'LivroReceitas-Central-Backup5min'
```

Cada snapshot modificado contém manifesto, bundle por HEAD, tracked.patch, pasta untracked, JOTAFY-MULTIPRODUTO.md e PROGRESSO.md automático com arquivos alterados. `latest.json` aponta o último backup; `last-run.json` informa a conferência. Sem mudanças, não duplica todo o snapshot. Não inclui secrets/PDF privado/node_modules. Atualize as anotações a cada etapa e execute backup manual após mudanças importantes.

Restaurar SEMPRE em pasta nova: clonar o bundle indicado pelo manifesto, checkout do HEAD registrado, `git apply --binary tracked.patch`, copiar untracked preservando caminhos e instalar dependências pelo lockfile. Não restaurar por cima de alterações existentes sem comparação. Não interromper/desativar os backups enquanto continua o trabalho.
