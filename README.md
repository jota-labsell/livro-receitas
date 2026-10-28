> Integração atual: [Orders em sandbox](ORDERS-SANDBOX.md). Produção permanece bloqueada até validação oficial.

# 150 Doces para Comer e Vender — oferta de R$ 10

Página de venda com sequência vertical explícita em celular e desktop: **headline → GIF do e-book → depoimentos → benefícios → garantia de 7 dias → checkout Mercado Pago → demais detalhes do livro**. Fundo branco, curvas roxas/magenta, oferta de R$ 10 e CTAs para `#checkout`. O material tem 150 receitas, 10 capítulos e 167 páginas em PDF, sem cadastro, assinatura ou produtos adicionais.

## Estado desta entrega

Next.js + TypeScript + OpenNext + Cloudflare Workers preservados. Payment Brick e Status Screen oficiais integrados pelo SDK `https://sdk.mercadopago.com/js/v2`. O backend HTTP usa a API de Orders do Mercado Pago em sandbox; consulte [ORDERS-SANDBOX.md](ORDERS-SANDBOX.md). O código de Payments permanece somente como referência de regressão dos testes legados; não há pagamento fictício ou liberação gratuita. O checkout permanece **desabilitado** até configurar infraestrutura e credenciais e testar oficialmente. A interface comunica indisponibilidade sem expor detalhes de implementação ao comprador.

O ambiente fornecido não tem credenciais Mercado Pago. A consulta à lista de D1 na Cloudflare retornou erro de autenticação 10000; não foi possível provisionar a base remota. O ID zerado em `wrangler.jsonc` é um marcador explícito para configuração, não uma base existente. A publicação da vitrine pode ser feita independentemente desses bloqueios com `npm run cloudflare:deploy:vitrine`. Esse comando omite o D1 e mantém cobranças e downloads bloqueados. A medição persistida requer o D1 configurado.

## Executar e conferir

Node 22+ e Chromium em `/usr/bin/chromium` (ajuste o caminho em `playwright.config.ts` em outra máquina):

```sh
npm ci --cache /tmp/npm-cache
npm run dev
# Em outro terminal, com a página na porta 3000:
npm run typecheck
npm test
npm run build
npm run cloudflare:build
```

`npm test`: testes financeiros em D1 local real via Miniflare, seguidos de interface em 360px, 402px e 1440px. Os testes financeiros usam respostas controladas do provedor; os de interface usam um SDK substituto somente nos cenários de estado. **Nenhum deles equivale ao sandbox oficial do Mercado Pago.** O restante da interface usa o backend real com pagamentos indisponíveis. Capturas, logs e bundles de teste ficam em `work/`, ignorado pelo Git.

## Produto verdadeiro, arquivo privado

O PDF completo fica em `private/150-doces.pdf` apenas para preparação local; está ignorado pelo Git e excluído do rastreamento de arquivos do build. Não é asset público. Coloque a edição verdadeira nesse caminho a partir de seu arquivo original, fora do controle de versão.

`public/ebook/manifest.json` registra SHA-256, tamanho, contagem e páginas selecionadas. As amostras e o vídeo foram extraídos desse mesmo PDF. Para regenerar (Poppler, FFmpeg e Sharp):

```sh
npm run prepare:ebook -- 7 23 39 55 71 119 151
```

Somente capa, sete amostras selecionadas e prévia podem ser públicos, nunca o livro inteiro. O arquivo de entrega é buscado no binding **R2 privado** `EBOOKS`, em `sha256/<hash>.pdf`, e transmitido por `/api/download` após autorização. Não habilite domínio público do bucket.

## Compra e autorização

- `POST /api/checkout` cria/reutiliza pedido persistido, preço em centavos e moeda definidos pelo servidor. Cookie aleatório HttpOnly/Secure/SameSite identifica a compra sem conta; o banco guarda apenas seu hash. `GET /api/checkout` só expõe a chave pública e os tipos realmente ativos retornados pelo Mercado Pago (cartões e/ou Pix; sem wallet ou boleto anunciados indiscriminadamente).
- `POST /api/payments` seleciona uma tentativa atomicamente em D1. A tentativa é a chave de idempotência do provedor e a referência externa; envios simultâneos reutilizam a chave. Uma impressão do payload detecta alteração durante uma tentativa em curso sem persistir nome, e-mail, documento ou token de cartão. Um timeout deixa o pedido em conferência, e não autoriza nova cobrança com outra chave.
- A resposta de criação não concede acesso: o backend consulta `/v1/payments/:id` e confere pedido, tentativa, produto, conta recebedora, valor de R$ 10,00, moeda BRL e modo sandbox/produção. Valor enviado pelo navegador é descartado. Somente o servidor altera os estados.
- `POST /api/orders/status` consulta o provedor. Recupera respostas perdidas pesquisando a referência externa, sem repetir a compra. Uma recusa confirmada permite nova tentativa com outra chave; uma tentativa incerta mantém a mesma referência.
- O webhook valida HMAC SHA-256 sobre `data.id` da URL, `x-request-id` e `ts`, com janela de dez minutos e comparação segura. O ID do corpo deve coincidir com o assinado. Só então consulta a API oficial. Mudanças de estado e evento de compra são gravados em transação D1; timestamps antigos não sobrescrevem estados novos. Reentregas não duplicam a compra.
- `GET /api/download` exige o cookie vinculado ao pedido, reconfirma os pagamentos aprovados no provedor e só transmite R2 quando a compra permanece aprovada. Estorno/contestação revoga acesso. A antiga rota gratuita retorna 410 e seu cookie não é aceito. Redirects e parâmetros do navegador nunca liberam o produto.

As credenciais privadas só vêm dos bindings do Worker. O público não recebe tokens de acesso. A criação de pedidos, consultas e eventos exige a origem da aplicação. Nenhum dado de cartão é persistido.

## Medição

`funnel_events` guarda `offer_view`, `cta_click`, `checkout_start` e `purchase_approved`. Oferta e início são únicos por visita; cliques usam ID próprio. A compra é única por pedido e gravada pelo backend na transação de aprovação. O endpoint público rejeita compras declaradas pelo navegador. Payloads são limitados a nome permitido do evento e IDs aleatórios; não contêm nome, e-mail, parâmetros livres, URL ou dados de pagamento.

Consulta de funil, no D1 autenticado:

```sql
SELECT name, COUNT(*) AS eventos, COUNT(DISTINCT visit_hash) AS visitas
FROM funnel_events
WHERE created_at >= 0 -- substituir pelo início do período em milissegundos
GROUP BY name;
```

Compare visitas de oferta → clique → checkout → compra dentro do mesmo período. Vários pedidos podem pertencer à mesma visita; número de pedidos e número de visitas compradoras são medidas distintas. Compras são contadas uma vez quando aprovadas; estornos ficam no estado dos pedidos e devem ser considerados para receita líquida. Não há previsão de conversão sem dados reais.

## Operação

Ver [CLOUDFLARE.md](CLOUDFLARE.md) para D1/R2, credenciais, matriz obrigatória de sandbox e ativação. O cookie de compra dura até 30 dias; limpar os dados do navegador remove o acesso automático. Atendimento: receitaspremium150@gmail.com. A oferta tem garantia de 7 dias, autorizada pelo responsável: solicitações de reembolso são recebidas pelo mesmo e-mail, dentro de 7 dias após a compra, com referência do pagamento. O atendimento processa a solicitação; a página não promete estorno automático ou imediato.

## Demonstração visual e prints do Instagram

A vitrine usa `lib/ebook-preview.ts`, com as amostras públicas geradas da edição identificada pelo SHA-256. A apresentação não depende da disponibilidade do PDF completo no R2: capa, galeria e loop continuam visíveis mesmo durante a configuração da entrega. O checkout e o download mantêm as verificações privadas de pagamento e arquivo.

A apresentação principal usa o GIF `1027.gif` fornecido pelo usuário no arquivo `1027.zip`, preservado sem alterações em `public/product-video/1027-loop.gif`: 400×711, 300 quadros, 20 segundos e repetição infinita. A origem e o SHA-256 estão em `public/product-video/source.json`. O GIF é renderizado como imagem nativa, sem player de vídeo. A pausa congela o quadro no navegador, e movimento reduzido mantém a prévia estática. O MP4 anterior é mantido apenas como arquivo de origem disponível; não aparece no player principal.

O painel de benefícios destaca o conteúdo do PDF, o preparo organizado, o planejamento de vendas para buscar renda extra e o acesso no celular após o download. Não há promessa de renda garantida. As condições da compra vêm imediatamente antes do checkout; as páginas reais, categorias e a explicação detalhada do conteúdo continuam depois dele.

Depoimentos aceitam somente prints verdadeiros fornecidos pelo responsável pela oferta. Os três prints enviados no arquivo `Desktop.rar` foram copiados sem alteração para `public/testimonials/`: cookies da Juliana, brownie e morangos. `content/testimonials.json` registra caminhos, descrições acessíveis e dimensões originais. O componente os posiciona logo após o GIF, com três imagens visíveis no desktop, rolagem no celular e ampliação por toque ou teclado.

## Headline e referência tipográfica

Headline: “Receba 150 receitas, dos clássicos aos doces virais do TikTok e Instagram, para fazer e vender!”. O topo usa composição centralizada, fonte Baloo 2 encorpada e arredondada, número em roxo e destaque magenta com marcação amarela. A fonte é hospedada localmente, com subconjunto latino e licença em `app/fonts/BALOO2-OFL.txt`; o navegador não faz requisições ao Google Fonts. A referência visual foi aplicada à tipografia e aos destaques, mantendo a oferta de R$ 10 e os prints já aprovados.
