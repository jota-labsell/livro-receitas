# Retomada da central de gestão — 30/10/2026

## Onde continuar

- Repositório: jota-labsell/livro-receitas.
- Checkout de trabalho: `C:\Users\João\Projetos\livro-receitas\work\meta-github-release`.
- Branch local: `release/central-gestao-20261030`; origem: `origin/feat/central-gestao`.
- Base remota conferida: `aeb651e`, que já inclui `486b163`, ponta de `origin/feat/150-doces-r10`. `git fetch origin` não encontrou atualizações posteriores.
- A cópia principal `C:\Users\João\Projetos\livro-receitas` está em `056205b`, com muitas alterações locais e arquivos não rastreados. NÃO fazer reset, clean, stash indiscriminado nem substituir essa cópia. Ela foi preservada.
- Ler `AGENTS.md`, `CENTRAL-GESTAO.md` e este documento antes de continuar. Usar `npm.cmd` no PowerShell.

## Produção e banco confirmados

- Site: https://livro-receitas.joaolucasqtb.workers.dev.
- Última versão ativa consultada antes desta publicação: `c5533b1f-4a1b-4837-9695-507160a229ac`, 100% do tráfego, deploy manual de 30/10/2026 04:22 UTC. A central nova AINDA NÃO foi publicada nesta retomada.
- Conta Cloudflare: `48a86816b0ea33a5e9da7eb156dd98b1`.
- Identidade atual: OAuth do Wrangler, e-mail do proprietário; nenhuma variável `CLOUDFLARE_API_TOKEN` no processo. OAuth tem D1 write e Workers write. Não houve novo login ou rotação de secrets.
- D1: `receitas-premium-150-orders`, ID `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`.
- `d1 migrations list --remote`: nenhuma pendente. Histórico contém `0010_operations.sql` e as sete tabelas `operation_*` foram verificadas, inclusive as colunas de `operation_admin_sessions`. Não reaplicar 0010. O 403/7403 anterior não foi reproduzido.
- Consulta somente leitura: 44 pedidos totais; 2 aprovados de produção. Nenhuma conta de operador cadastrada. Não criar compras fictícias nem gerar links para clientes sem confirmar autorização.
- Flags remotas: checkout e pagamentos reais habilitados, modo production, CAPI habilitada. Secrets existentes preservados. R2 privado vinculado. Cron Meta `*/5 * * * *` confirmado.

## Trabalho preservado e revisado

- Correções locais já existentes foram retomadas, não refeitas: sessões administrativas registradas no D1 e revogadas no logout e em toda alteração de conta; validação de concorrência; proteção das páginas e APIs; configuração inicial separada em `/admin/configurar`.
- UTMs mantêm a primeira origem da sessão e acompanham o pedido. Falhas de tracking não autorizam pagamentos nem bloqueiam entrega. Pixel antigo permanece vinculado ao pedido; CAPI pausa com segurança quando a configuração não pode ser lida.
- Melhoradas as distinções de diagnóstico entre configuração e confirmação externa. Não há alegação de atribuição oficial Meta Ads ou entrega FCM no aparelho.
- Documentação de cadastro e revogação atualizada em `CENTRAL-GESTAO.md`.
- Assistente de credencial agora localiza o arquivo criptografado no checkout original via Git common dir, sem copiar ou substituir a chave.
- Deploy recebe tag e mensagem com o commit para correlacionar código e versão publicada.

## Testes nesta retomada

Passaram: TypeScript inicial; comércio 22; recuperação/entrega 18; Meta 17; operações/autenticação 9; credencial criptografada 2 (repetidos após alteração do assistente); guards de deploy 4; interface da central em 360 e 1440 px; `npm ci --dry-run --ignore-scripts` (consistência com lockfile).

Build Cloudflare/OpenNext PASSOU e gerou `.open-next/worker.js`; validação de artefato PASSOU (sem PDF privado em assets/server-functions e sem variáveis privadas no módulo next-env). Deploy de produção `--dry-run` PASSOU: 52 assets; upload 6374.21 KiB, gzip 1349.92 KiB.

Suíte Playwright de 114 testes FINALIZADA: 113 passaram e 1 falhou por timeout em `SDK is reused and Brick teardown finishes before remount`, viewport 360px: `.check()` no radio Pix aguardou estabilidade. O mesmo teste passou em 402px e desktop. Investigar e repetir o teste isoladamente com trace antes de mudar código ou declarar os testes completos. A execução usa `PLAYWRIGHT_USE_PRODUCTION=true` e `next start` local na porta 3000.

Repetição isolada do teste que falhou: DUAS execuções em 360px passaram (5,2s e 4,5s), com trace e um worker, sem alteração do checkout. O timeout da suíte completa permanece registrado como instabilidade observada. A nova checagem TypeScript e os quatro guards passaram. Processos de teste não são backup e não sobrevivem ao desligamento.

Foi criado um D1 SOMENTE LOCAL em `work/management-smoke-state` com as sete migrations do checkout. Isso NÃO aplicou migrations no banco remoto. `node scripts/test-management-worker.mjs` PASSOU contra o artefato real via Wrangler dev HTTPS local: APIs e cadastro protegidos, origem estrangeira rejeitada, cadastro autenticado, cookies Secure/HttpOnly/Strict e sete dias, dashboard com consultas D1 reais em 360/1440px, senha atual obrigatória, revogação global e logout. Dados exclusivamente locais, sem clientes ou secrets de produção.

Para repetir: iniciar `node node_modules/wrangler/bin/wrangler.js dev --local --ip 127.0.0.1 --port 8787 --local-protocol https --persist-to work/management-smoke-state --var EBOOK_ADMIN_KEY:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --var SITE_URL:https://127.0.0.1:8787 --var META_CAPI_ENABLED:false --var CHECKOUT_ENABLED:false --var LIVE_PAYMENTS_ENABLED:false` e, em outro terminal, executar o teste acima. A chave a*64 é somente fixture local e NUNCA deve ser configurada em produção.

## Builds automáticos: bloqueio real, causa ainda desconhecida

- GitHub confirma Workers Builds com falha no commit `486b163`, para `livro-receitas` e também `receitas-premium-150`; Pages teve sucesso; job Actions foi skipped.
- Build principal: `65f22c17-d91c-4576-ae02-3caf1d04a142`.
- Logs: https://dash.cloudflare.com/48a86816b0ea33a5e9da7eb156dd98b1/workers/services/view/livro-receitas/production/builds/65f22c17-d91c-4576-ae02-3caf1d04a142.
- GET API `builds/builds/<id>/logs`: HTTP 403 / 12004. Listagem de builds: mesmo erro. Triggers: HTTP 403 / 10000. O OAuth de deploy não concede acesso aos Workers Builds.
- Foi pedido ao proprietário acesso local sem enviar segredo no chat. Permissão documentada para configurar: token de usuário `Workers Builds Configuration: Edit`; logs aceitam `Workers CI Read` ou `Workers CI Write` na referência da API. `Workers Scripts: Read` para localizar o Worker tag. Tag já conferida: `700b75851473421caa9aa6e6216832fd`.
- GitHub Actions não tem secrets nem variables. O workflow só publica automaticamente com `CLOUDFLARE_ACTIONS_DEPLOY=true`; não foi ativado.
- Pages existente: projeto livro-receitas, branch production feat/150-doces-r10, raiz vazia, build `npm run cloudflare:build`; não é o Worker servido em workers.dev. Não apagar/desativar integrações indiscriminadamente.
- NÃO afirmar causa dos builds sem ler o primeiro erro. Alterar Actions não corrige Workers Builds.
- Referência: https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/.

## Próximos passos obrigatórios

1. Testes concluídos; manter no relatório o timeout da suíte completa e o sucesso das duas repetições isoladas.
2. Smoke test autenticado do artefato Cloudflare local concluído. Não confundir esse teste com acesso real do proprietário.
3. Com acesso aos logs, diagnosticar e corrigir a primeira causa do Workers Builds; revisar branch/raiz, Node/lockfile, build OpenNext, deploy com guards, permissões D1/build, variáveis e integrações concorrentes. Sem esse acesso, registrar a pendência precisa.
4. Commitar tudo que foi revisado; fazer fetch e conferir novamente ambas as branches antes do push. `feat/central-gestao` já descende da fonte atual de produção, portanto a integração prevista é fast-forward, sem sobrescrever novas mudanças remotas.
5. Publicar por `npm.cmd run cloudflare:deploy:production`, com os guards do D1, R2, secrets e cron preservados. Registrar commit, tag e version ID real. Não declarar publicação pelo push.
6. Verificar tráfego/versão ativa, `/api/checkout` GET disponível com amount 10, APIs administrativas 401 sem sessão, redirecionamento de `/admin`, login acessível, bloqueio de download com interface adequada e cron preservado. Sem cobranças reais e sem reenviar conversões.
7. Push das branches central e produção coerentes com o commit publicado. Monitorar os builds nativos que o push disparar para confirmar que não substituíram a versão por outra fonte.
8. Atualizar este documento e relatório final com resultados reais e limitações. Recuperação com pedido real e acesso do proprietário dependem da identidade/autorização adequada; não inventar a conclusão.

## Primeiro cadastro seguro

Executar `npm.cmd run gestao:configurar` em terminal interativo do checkout. Informar a senha de proteção local; a chave criptografada existente é copiada para a área de transferência e o navegador abre `/admin/configurar`. Usá-la uma vez, abrir Minha conta, escolher e-mail/senha próprios e entrar novamente em `/admin/entrar`. Criação da conta revoga a sessão de configuração. Não há senha padrão e nenhuma senha deve entrar no Git ou chat.

## Recuperação deste ponto

Os checkpoints de código são commits na branch local e são enviados a `feat/central-gestao` quando indicado. Os backups periódicos ficam fora do repositório, em `C:\Users\João\Documents\Backup-livro-receitas-central`. Cada snapshot contém um manifesto, patch das mudanças rastreadas e arquivos novos de código; bundles Git por commit permitem recuperar o histórico. Credenciais e diretórios ignorados, PDF privado, node_modules e assets gerados não entram no backup periódico.

Rotina Windows registrada: `LivroReceitas-Central-Backup10min`, a cada 10 minutos, executando `scripts/backup-progress.mjs` com Node. Funciona na sessão do usuário, inclusive após reiniciar e entrar no Windows; não executa enquanto o notebook estiver desligado. Sem alteração de código, apenas atualiza a conferência, evitando cópias redundantes. Verificar `latest.json` e `last-run.json` na pasta de backup; falhas ficam em `last-error.txt`. Executar manualmente com `node scripts/backup-progress.mjs`. Consultar o agendamento com `Get-ScheduledTaskInfo -TaskName LivroReceitas-Central-Backup10min`. A rotina não faz deploy nem push automático, não altera o checkout e não remove snapshots antigos.

Antes de restaurar, guardar o checkout atual. Consultar `manifest.json`, clonar o bundle correspondente em uma pasta nova, fazer checkout do HEAD registrado, aplicar `tracked.patch` com `git apply --binary` e copiar os arquivos de `untracked` para seus caminhos relativos. Restaurar em pasta nova evita sobrescrever trabalho existente. Executar `npm.cmd ci` e refazer o build. Credenciais operacionais permanecem no armazenamento local já existente e na Cloudflare.
