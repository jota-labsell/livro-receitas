# Painel de operação — revisão visual

Base: 2dfd3d8, preservando a autenticação com revogação e as verificações de produção incorporadas no terminal.

Interface inspirada na referência fornecida: navegação lateral compacta/expansível, tema azul escuro, filtros superiores, matriz de indicadores, funil vertical por sessão, vendas por produto, receita por fonte e diagnóstico de envio. Identidade própria de Receitas Premium, sem uso de marca ou logotipo da referência.

Filtros de Hoje, Ontem, 7 dias, 30 dias ou datas personalizadas. Origem de tráfego aplicada no servidor à receita, lista de pedidos, evolução diária e coorte do funil. Busca e status específicos do histórico não ficam ocultamente ativos ao voltar para a visão geral.

A API acrescenta valores nominais pendentes, reembolsados e contestados. O período financeiro usa criação dos pedidos e estado atual, não um extrato de liquidações. Reembolsos nominais não comprovam o montante efetivamente estornado em casos parciais. Receita por fonte e funil usam sessões iniciadas no período, acompanhadas até agora; podem diferir da receita por criação de pedido. Os envios Meta exibidos são globais.

Métricas sem fonte não viram zero: investimento, taxas, custos, impostos, ROAS e lucro exibem indisponibilidade com explicação. Conta de anúncios permanece explicitamente desconectada. Nenhum novo acesso à Meta Ads foi presumido. O funil exibe entradas e cliques no CTA do site, sem chamar esses eventos de cliques em anúncio.

Nenhuma nova migration. Nenhuma alteração em aprovação financeira, credenciais, download ou login. Os módulos administrativos existentes permanecem incorporados e recebem adaptação visual ao tema.

Validação: TypeScript e build Cloudflare, teste de layout e fluxos em 360px e 1440px, testes de operação/autenticação (10 casos) incluindo isolamento de origem e valores nominais. Capturas locais em work/management-preview usam fixtures somente no teste, não dados de produção.

Publicação não realizada neste ambiente: a consulta obrigatória ao D1 continua recebendo HTTP 403, código 7403. Usar o fluxo de deploy validado, com identidade autorizada, após integrar esta branch à fonte de produção. Não remover o guard de banco para publicar.
