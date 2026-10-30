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

A troca de senha não revoga automaticamente todas as sessões assinadas existentes: elas vencem pelo prazo original. Para revogação global de emergência, rotacione EBOOK_ADMIN_KEY no ambiente seguro. Não há recuperação automática de senha por e-mail; a credencial administrativa de configuração permanece como mecanismo operacional de recuperação, sem exposição no painel.

## Publicação

Necessária a migration aditiva 0010_operations.sql no banco atual, depois o build e deploy. O script de deploy verifica as novas tabelas e não pula as verificações anteriores.

```sh
npx wrangler d1 execute receitas-premium-150-orders --remote --file migrations/0010_operations.sql
npm run cloudflare:build
npm run cloudflare:deploy:production
```

Não foi publicada nesta sessão: a credencial disponível recebe HTTP 403 / 7403 ao consultar esse D1. Não houve tentativa de contornar a proteção nem de substituir produção por uma versão sem a migration.

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
