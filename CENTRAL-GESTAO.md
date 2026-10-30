# Central de gestão

Implementação baseada no commit 486b163, na branch feat/central-gestao. A tela principal é /admin, com login em /admin/entrar.

## Funcionalidades

- Vendas e receita dos pedidos criados no período, com status atual, ticket, pendências e reversões.
- Histórico com datas de Brasília, status, busca por ID de pedido/pagamento, paginação e CSV da página atual, com proteção contra fórmulas em planilhas.
- Atendimento e diagnóstico Meta existentes incorporados ao painel.
- Coleta de UTMs por sessão, gerador de links, origens/campanhas e funil por sessão iniciada no período. Dados anteriores à implantação não são reconstruídos. Cada etapa é independente; perdas de eventos podem fazer etapas posteriores superarem as anteriores. Sessão corresponde ao identificador do sessionStorage, não a pessoa identificada.
- Produto atual consultável, configuração de Pixel e pausa dos envios CAPI. O produto continua único; valores financeiros permanecem em product.config.ts e na validação server-side. Não há mudança de preço pelo navegador.
- Pixel associado ao pedido para manter os envios futuros consistentes com a compra original. Pedidos anteriores usam o Pixel original. A pausa não apaga a fila nem muda o event_id.
- Saúde: consulta do banco e objeto privado, configuração de pagamentos/Meta, filas globais de Meta/FCM e horário de execução observado do processamento Meta, com aviso após 15 minutos sem observação. Configuração não é prova de disponibilidade externa; aceitação no FCM não é prova de exibição no aparelho.

## Login com e-mail e senha

A conta é única para o operador. A criação não é pública. Entre com a sessão administrativa existente e vá em Minha conta, ou use uma vez o acesso de configuração /admin/acesso/entrar e depois a central /admin. Cadastre e-mail e senha de pelo menos 12 caracteres. Os acessos seguintes usam /admin/entrar, sem colar a chave. Campos são compatíveis com gerenciadores de senha.

A senha usa PBKDF2 SHA-256 com 100 mil iterações (compatível com o limite WebCrypto Workers), salt aleatório de 32 bytes e comparação de tempo constante. Senhas não são registradas em logs. Login tem cotas por origem e global. E-mail/senha inválidos geram resposta genérica. Alterar conta existente exige a senha atual e sessão autenticada. Cookies são Secure, HttpOnly, SameSite Strict; sessão padrão de uma hora ou sete dias se escolhido. Sair apaga o cookie deste navegador.

As sessões são assinadas e registradas por hash em operation_admin_sessions. Toda página e API administrativa verifica também esse registro no servidor. Sair revoga a sessão no banco, inclusive para cópias do cookie. Criar a conta ou alterar credenciais revoga todas as sessões anteriores atomicamente com a atualização e exige novo login. A atualização compara o hash anterior para impedir alterações concorrentes. Cookies antigos, anteriores a este registro, não são aceitos. Rotacionar EBOOK_ADMIN_KEY continua sendo uma opção de emergência. Não há recuperação automática de senha por e-mail.

### Primeiro cadastro do proprietário

No terminal interativo deste checkout, execute `npm.cmd run gestao:configurar`. Informe somente no terminal a senha de proteção local da credencial operacional já provisionada. O assistente localiza o arquivo criptografado no checkout original mesmo quando executado em um worktree, copia a chave para a área de transferência e abre /admin/configurar. A chave não aparece no terminal nem deve ser enviada pelo chat.

Autentique essa configuração uma vez, abra Minha conta e escolha e-mail e senha próprios (12 a 256 caracteres; use um gerenciador de senhas). O cadastro encerra inclusive a sessão de configuração. Entre novamente em /admin/entrar, usando e-mail e senha. Não existe senha padrão, inscrição pública ou conta criada pelo processo de deploy. A chave operacional fica restrita à configuração e recuperação; não é necessária no acesso cotidiano. Sem a senha de proteção local, o assistente não decifra a chave e não a substitui automaticamente.

## Publicação

Necessária a migration aditiva 0010_operations.sql no banco atual, depois o build e deploy. O script de deploy verifica as novas tabelas e não pula as verificações anteriores.

```sh
npx wrangler d1 migrations list receitas-premium-150-orders --remote
# Somente se houver migrations pendentes necessárias, após revisar a lista:
npx wrangler d1 migrations apply receitas-premium-150-orders --remote
npm run cloudflare:build
npm run cloudflare:deploy:production
```

Na retomada em 30/10/2026, o terminal usa OAuth do Wrangler da conta 48a86816b0ea33a5e9da7eb156dd98b1, sem CLOUDFLARE_API_TOKEN no processo. O D1 e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a corresponde ao banco esperado. A migration 0010 já está no histórico e as sete tabelas operation_* foram confirmadas, inclusive operation_admin_sessions. Nenhuma migration foi reaplicada nesta retomada. O erro 403/7403 anterior não foi reproduzido.

## Privacidade

Coleta de origens respeita recusa existente e GPC. Parâmetros são limitados e armazenados sem URL completa, query ou fragmento. Sessões de atribuição são excluídas após 90 dias pela rotina de manutenção; pagamentos são preservados. Em caso de bloqueio de coleta, a compra e a entrega continuam independentes. Requisições públicas exigem origem canônica e limite por origem pseudonimizada; como em qualquer telemetria pública, esses controles não provam que a visita veio de uma pessoa.

## Limites de integração

Atribuição interna por sessão não equivale à atribuição oficial da Meta. Cliques em anúncio, gasto, CPA/ROAS de mídia e edição/pausa de anúncios exigem conexão oficial à conta Meta Ads, não configurada aqui. O painel oferece a leitura interna por campanha e links rastreáveis, sem inventar métricas de mídia. Contagem de entradas no site não é contagem de cliques no anúncio. Gestão de múltiplos produtos, equipes, reembolsos financeiros pelo painel e disparo de e-mails não estão implementados.

## Validação

- Build Next e Cloudflare com validação de artefato.
- Regressão de comércio, acesso e CAPI, com serviços simulados.
- test:operations cobre autorização, origem, atribuição sem duplicar receita, configuração/auditoria, filtros, senha e sessão persistente.
- test:management:ui cobre layout 360px/1440px, funil e salvamento, com dados explicitamente fictícios apenas no teste. Capturas em work/management-preview; não são evidência de vendas reais.
- Testes não geram cobrança, evento Meta real, push ou pedido de produção.
