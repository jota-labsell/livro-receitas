# 150 Doces para Comer e Vender — oferta de R$ 10

Vitrine curta em três blocos, com composição vertical em celular e desktop: promessa e livro real → demonstração de três receitas → checkout e entrega. Fundo branco, curvas roxas/magenta, preço único e botões para `#checkout`. A edição demonstrada tem 150 receitas, 10 capítulos e 167 páginas. Sem cadastro, assinatura, depoimentos inventados ou produtos adicionais.

## Estado desta entrega

Next.js + TypeScript + OpenNext + Cloudflare Workers preservados. Payment Brick e Status Screen oficiais integrados pelo SDK `https://sdk.mercadopago.com/js/v2`. O backend usa a Payments API do Mercado Pago; não há pagamento fictício ou liberação gratuita. O checkout permanece **desabilitado** até configurar infraestrutura e credenciais e testar oficialmente. A interface comunica indisponibilidade sem expor detalhes de implementação ao comprador.

O ambiente fornecido não tem credenciais Mercado Pago. A consulta à lista de D1 na Cloudflare retornou erro de autenticação 10000; não foi possível provisionar a base remota. O ID zerado em `wrangler.jsonc` é um marcador explícito para configuração, não uma base existente. Não foi ativada cobrança real nem realizado deploy sobre a oferta anterior.

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

Ver [CLOUDFLARE.md](CLOUDFLARE.md) para D1/R2, credenciais, matriz obrigatória de sandbox e ativação. O cookie de compra dura até 30 dias; limpar os dados do navegador remove o acesso automático. Atendimento: receitaspremium150@gmail.com. Não há garantia comercial adicional anunciada.
