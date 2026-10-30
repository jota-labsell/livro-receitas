# Central de gestão — publicação de 30/10/2026

## Publicação confirmada

- Painel: https://livro-receitas.joaolucasqtb.workers.dev/admin.
- Login normal: /admin/entrar, e-mail e senha; primeira configuração operacional: /admin/configurar.
- Código publicado: `fe0ea125f8b30af043faf1ba6dfb8f95159cfcf0`.
- Branches GitHub integradas: `feat/150-doces-r10` e `feat/central-gestao`, por fast-forward.
- Versão Worker: `88ac37cf-fcaa-4b05-bb67-4349c0ad493e` (versão número 69), 100% do tráfego.
- Deployment: `9aa42ed5-e578-42b7-ae1d-42c251a0751f`, 06:08 UTC.
- Método: build Cloudflare/OpenNext validado e `npm.cmd run cloudflare:deploy:production` com todos os guards do banco. Tag `fe0ea125f8b3` e mensagem do commit confirmadas pela API de versões.
- Commits de relatório posteriores não modificam o código da aplicação publicado.

## Implementação finalizada

Preservada a implementação existente da central, incorporando as correções locais: verificação de sessão no D1 em todas as páginas e APIs administrativas; logout revoga o cookie copiado; criação/troca de conta revoga globalmente as sessões em transação; alteração exige senha atual e evita escrita concorrente. Hash PBKDF2 SHA-256 com salt, cookies Secure/HttpOnly/SameSite Strict, duração de uma hora ou sete dias, controle de origem e cotas de login.

Mantidos painel unificado, filtros/paginação/CSV, atendimento e entrega, diagnóstico Meta, funil por sessão, UTMs, Pixel por pedido e pausa CAPI independente de pagamento/download. Histórico anterior não recebe atribuição inventada; Meta Ads permanece integração pendente. Configuração não é apresentada como confirmação externa de entrega/atribuição.

## Migrations e preservação

OAuth atual tem acesso ao D1 da conta correta; não havia CLOUDFLARE_API_TOKEN de ambiente sobrescrevendo OAuth. O erro antigo 403/7403 não se repetiu. Banco `receitas-premium-150-orders`, ID `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`, confirmou 0010 já no histórico e todas as tabelas, inclusive sessões. Nenhuma migration remota precisou ser aplicada nesta retomada.

Não houve reset da cópia principal, exclusão de tabela, rotação de chave, mudança de preço, cobrança, pedido fictício, reenvio de conversão ou emissão de recuperação de cliente. Pedidos continuaram em 44. Secrets de pagamentos, webhook, Meta e administração, R2 privado, notificações e cron de cinco minutos preservados.

## Testes

- TypeScript: passou.
- Comércio: 22; recuperação/entrega: 18; Meta: 17; operações/autenticação: 9; credencial criptografada: 2; guards deploy: 4 — passaram.
- Interface central: 360/1440px passou.
- Playwright aplicação: 113 de 114 passaram na suíte completa; um timeout de estabilidade no radio Pix em 360px. O teste afetado passou nas duas repetições isoladas com trace, sem alteração do checkout. Mesma verificação passou em 402px e desktop na suíte completa. Instabilidade registrada, sem desativar verificação.
- Artefato Cloudflare em Wrangler local com D1 real local: login, cadastro restrito, origem, cookie de sete dias, painel 360/1440px, mudança de senha, revogação e logout passaram.
- Consistência lockfile: npm ci dry-run passou. Build OpenNext, validador de artefato e dry-run de deploy passaram; PDF privado fora dos assets e funções geradas, next-env apenas com variáveis públicas.
- Produção: checkout GET disponível, preço 10, modo production, cartão/Pix; APIs administrativas 401 sem sessão; account POST 401; sessão de origem estrangeira 403; /admin redireciona; login e recuperação mobile/desktop sem overflow; download não autorizado 303, sem acesso ao PDF. Versão/tráfego e cron consultados via API.

Limites: serviços externos nos testes automatizados foram simulados; não foi feita cobrança ou compra de produção. Nenhum teste desta retomada comprova atribuição de campanha Meta, recebimento real de evento novo, exibição FCM no aparelho ou recuperação de um cliente real. A conta do proprietário não foi criada pelo deploy.

## Builds automáticos ainda pendentes

A causa dos builds nativos Failed NÃO foi comprovada: GET dos logs respondeu 403/12004, triggers 403/10000. Build anterior `65f22c17-d91c-4576-ae02-3caf1d04a142`, novo check Failed `7f62a142-6825-4097-b1a7-325e02d72a36`. As saídas de check-run no GitHub só contêm link para o painel, sem log/primeiro erro.

Permissão ausente: credencial de usuário para Workers Builds (`Workers Builds Configuration: Edit` para configurar; logs aceitam `Workers CI Read` ou `Workers CI Write`). OAuth de Workers/D1 não oferece esse acesso. Não foi tentado contornar a autorização. Referências oficiais: https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/ e https://developers.cloudflare.com/api/resources/workers_builds/subresources/builds/subresources/logs/methods/get/.

Workers Builds é distinto de Actions. GitHub Actions não tem secrets/variables e seu job ficou skipped; não foi ativado. Pages está conectado separadamente à mesma branch, com build cloudflare:build e raiz vazia; seu sucesso não comprova atualização do Worker. Existe também build nativo para o Worker receitas-premium-150. Nenhuma integração foi apagada/desativada para ocultar a falha.

Fluxo principal validado nesta entrega: terminal OAuth → build Cloudflare → guards D1 → deploy de produção → API de versão/tráfego → smoke tests públicos. Para concluir automação, obter acesso aos logs e então verificar a primeira causa, branch/raiz, Node/lockfile, geração OpenNext, paths, comandos, token de build, permissões D1 e variáveis build/runtime. Não alterar workflow de Actions como suposta correção do Workers Builds.

## Conta inicial e backups

Em terminal interativo do checkout, executar `npm.cmd run gestao:configurar`. Informar a senha local de proteção da chave já provisionada; a chave vai somente para a área de transferência. Autenticar uma vez em /admin/configurar, escolher e-mail/senha em Minha conta e entrar novamente em /admin/entrar. Nenhuma senha padrão; não enviar credenciais no chat. Detalhes em CENTRAL-GESTAO.md.

Backup automático local a cada dez minutos, tarefa `LivroReceitas-Central-Backup10min`, com execução testada (código 0). Pasta `C:\Users\João\Documents\Backup-livro-receitas-central`; manifesto, bundle por commit, patch e arquivos novos de código. Restauração do bundle testada em pasta separada. Secrets, PDF privado, node_modules e diretórios ignorados excluídos. A rotina volta após reiniciar e entrar no Windows; não roda com notebook desligado. Anotação para continuidade: RETOMADA-CENTRAL-GESTAO.md.
