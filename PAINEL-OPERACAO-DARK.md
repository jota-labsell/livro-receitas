# Painel de operação — revisão visual

Base: 2dfd3d8, preservando a autenticação com revogação e as verificações de produção incorporadas no terminal.

Interface inspirada na referência fornecida: navegação lateral compacta/expansível, tema azul escuro, filtros superiores, matriz de indicadores, funil vertical por sessão, vendas por produto, receita por fonte e diagnóstico de envio. Identidade própria de Receitas Premium, sem uso de marca ou logotipo da referência.

Filtros de Hoje, Ontem, 7 dias, 30 dias ou datas personalizadas. Origem de tráfego aplicada no servidor à receita, lista de pedidos, evolução diária e coorte do funil. Busca e status específicos do histórico não ficam ocultamente ativos ao voltar para a visão geral.

A API acrescenta valores nominais pendentes, reembolsados e contestados. O período financeiro usa criação dos pedidos e estado atual, não um extrato de liquidações. Reembolsos nominais não comprovam o montante efetivamente estornado em casos parciais. Receita por fonte e funil usam sessões iniciadas no período, acompanhadas até agora; podem diferir da receita por criação de pedido. Os envios Meta exibidos são globais.

Métricas sem fonte não viram zero: investimento, taxas, custos, impostos, ROAS e lucro exibem indisponibilidade com explicação. Conta de anúncios permanece explicitamente desconectada. Nenhum novo acesso à Meta Ads foi presumido. O funil exibe entradas e cliques no CTA do site, sem chamar esses eventos de cliques em anúncio.

Nenhuma nova migration. Nenhuma alteração em aprovação financeira, credenciais, download ou login. Os módulos administrativos existentes permanecem incorporados e recebem adaptação visual ao tema.

Validação: TypeScript e build Cloudflare, teste de layout e fluxos em 360px e 1440px, testes de operação/autenticação (10 casos) incluindo isolamento de origem e valores nominais. Capturas locais em work/management-preview usam fixtures somente no teste, não dados de produção.

Publicação não realizada neste ambiente: a consulta obrigatória ao D1 continua recebendo HTTP 403, código 7403. Usar o fluxo de deploy validado, com identidade autorizada, após integrar esta branch à fonte de produção. Não remover o guard de banco para publicar.

## Publicação concluída pelo terminal autorizado — 30/10/2026

O bloqueio do ambiente de implementação acima não ocorreu neste terminal: OAuth da conta 48a86816b0ea33a5e9da7eb156dd98b1 confirmou acesso a Workers e D1. Sem migrations pendentes. Integrado por fast-forward em feat/150-doces-r10 e publicado o commit 8d675e77f4fddf861667cb43e728d332db3bb64e pelo script de produção, com todos os guards.

Versão ativa confirmada com 100% do tráfego: **560a2b54-488f-4770-a862-4280ac48db46**, às 14:49 UTC. Painel: https://livro-receitas.joaolucasqtb.workers.dev/admin. TypeScript, operações/autenticação 10, comércio 22, acesso/entrega 18, Meta 17, guards 4, UI 360/1440px, build Cloudflare e dry-run passaram. Artefato real em Wrangler local autenticado confirmou tema, filtro Hoje, indicadores e funil, além de revogação de sessões e logout.

Na produção, /admin redireciona ao login escuro; APIs protegidas retornam 401, origem estrangeira é rejeitada, download sem autorização é bloqueado com recuperação e checkout permanece disponível por R$ 10. CSS e chunk do painel comparados byte a byte ao artefato testado. Conta e sessões do proprietário foram preservadas, sem usar sua senha para teste autenticado em produção. Cron, filas, Pixel, secrets e pagamentos preservados. Sem cobranças ou conversões fictícias. Detalhes e ponto de retomada em RETOMADA-CENTRAL-GESTAO.md.
