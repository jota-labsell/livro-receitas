# Relatório de produção e Meta Ads — 28/10/2026

## Atualização Pix e recorte do checkout

- O provedor passou a retornar Pix ativo; a integração já incluía `bankTransfer:all` quando esse método estava disponível. Nenhum Pix foi forçado ou simulado.
- Foi encontrada uma publicação posterior (`668d2a14-0ff2-45c4-9603-56a3f3c96e58`) em sandbox, após a publicação de produção. A chave pública e o vendedor configurado eram iguais aos da versão anterior. Produção foi restaurada pelo comando autorizado, sem trocar credenciais.
- A origem dessa publicação posterior não foi confirmada: a API de Workers Builds retornou 403 para o login local. Não se atribui a alteração a automação sem essa confirmação.
- No SDK real, Pix aparece abaixo das opções de cartão. Ao selecioná-lo, surge o campo de e-mail para receber o código Pix.
- A seleção fazia o SDK deslocar internamente a seção checkout: scrollLeft 77 em 360px e 310 em desktop, cortando campos. A correção em `app/globals.css` usa `overflow:clip` na seção para preservar o recorte da decoração sem permitir essa rolagem.
- Commit da correção na branch `feat/150-doces-r10`: `a38e1bff94605269e93e5398c080afe192d680a4`.
- Build Next.js/TypeScript/OpenNext e validação do artefato passaram; dry-run de produção passou. A consulta remota à coluna environment do D1 passou novamente no deploy.
- Versão publicada com a correção: `2293b365-2644-4dee-baf6-660eff019471`.
- GET /api/checkout: available:true, mode:production, amount:10, creditCard:all, debitCard:all, bankTransfer:all, maxInstallments:1.
- GET /api/marketing: enabled:true.
- Validação **no SDK real publicado**, sem substituição de SDK: Pix selecionado e campo de e-mail visível em 360px, 402px e 1440px. ScrollLeft 0 nos três; limites do formulário [8,352], [8,394] e [275,1165], respectivamente; nenhuma rolagem horizontal da página.
- Capturas locais: `work/screenshots/pix-fixed-production-{360,402,1440}.png`.
- Todas as chamadas a /api/payments foram bloqueadas preventivamente no navegador de validação; houve **zero tentativas de envio**. Não se preencheram dados de comprador, não se gerou QR Code e não se criou cobrança.
- Cartão inicial, personalizações do Brick, MP4, PDF privado, preço de R$ 10 e validações financeiras preservados. O exemplo de R$ 50 com pagador fictício não foi enviado.
- **Pendente:** compra real autorizada para comprovar geração e pagamento do Pix, aprovação, webhook, download, evento interno único e Purchase na Meta. O aparecimento do método no SDK não comprova essas etapas.

## Histórico: primeira publicação de produção

O responsável confirmou a configuração das credenciais e do webhook de produção. A publicação foi executada com `npm.cmd run cloudflare:deploy:production`, usando `XDG_CONFIG_HOME` apontado para a autenticação Cloudflare local já validada, sem copiar credenciais.

- Branch conferida: `feat/150-doces-r10`, ponta remota `25a6db656bb7e5f3678cc05287bab6e26c2c5389` antes deste registro. A aplicação na cópia validada coincide com a branch; diferenças de finais de linha e commits de preparação locais foram preservadas.
- Conta Cloudflare reconfirmada: `48a86816b0ea33a5e9da7eb156dd98b1`.
- D1 reconfirmado: `receitas-premium-150-orders`, binding ORDERS, ID `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`. Migrations apply remoto sem pendências. A consulta `SELECT environment FROM orders LIMIT 0` passou na conferência e novamente dentro do script de deploy.
- Artefato OpenNext já validado e sem mudanças na aplicação; não foram repetidos testes/build aprovados sem necessidade.
- Versão publicada: `374f597e-9a43-454d-a38c-af2a460dc22c`.
- URL: https://livro-receitas.joaolucasqtb.workers.dev
- GET /api/checkout após publicação: **available:true**, **mode:production**, **amount:10**. Cartão de crédito/débito e parcela única disponíveis na configuração retornada; Pix não anunciado.
- GET /api/marketing após publicação: **enabled:true**.
- Nenhuma cobrança, envio de pagamento ou compra foi realizado nesta etapa. Nenhum anúncio foi ativado.
- **Pronto para o responsável realizar a compra real de validação de R$ 10.** Aprovação, vendedor, webhook processado, download, evento interno único e recebimento de Purchase na Meta continuam pendentes dessa compra e da confirmação nos serviços reais.
- Marketing habilitado confirma a configuração de produção; não comprova recebimento de eventos pela Meta. O consentimento do visitante continua obrigatório.

As seções seguintes preservam o diagnóstico anterior à ativação; a indisponibilidade e a pendência de configuração de credenciais descritas nelas foram superadas pela atualização acima.

## Diagnóstico anterior à ativação

**Ainda não liberado para vendas reais nem campanhas.** A infraestrutura e o build foram validados, mas as credenciais e o webhook de produção precisam ser confirmados pelo responsável. O checkout foi temporariamente desabilitado antes da troca segura. Não houve cobrança real nem ativação de anúncios.

## Branch, histórico e ambiente

- Repositório: jota-labsell/livro-receitas; branch: `feat/150-doces-r10`.
- Ponta remota consultada: `00c1daa3a6cab1c022042315dd9546ce44de018b`; nenhuma atualização posterior encontrada nessa consulta.
- A pasta original estava em `056205b`, ancestral da ponta remota, com `RELATORIO-BUILD-DEPLOY.md` não rastreado. Esse arquivo e todos os arquivos/commits locais foram preservados.
- O Windows negou escrita na pasta original e em `.git/FETCH_HEAD`, mesmo com execução escalada. Não foram alteradas ACLs nem descartados arquivos.
- Cópia isolada atualizada: `C:\Users\João\AppData\Local\Temp\livro-receitas-release-20261028`. Ela contém os oito commits posteriores a `056205b`, incluindo as personalizações do checkout e o Pixel.
- Commit de ajustes: `868cd6be8e66d2ec7c647490f745b24796e916c7` — Support Windows release checks and correct production operation guidance. O relatório é registrado em commit separado nesta mesma branch.
- O push por Git local não tinha credencial. O envio foi concluído pela conexão GitHub autenticada, com commits descendentes de 00c1daa e atualização normal da referência. Os commits de preparação locais b9275b7/befb834 permaneceram na cópia temporária; os hashes remotos diferem pela autoria/data da conexão. A pasta original não teve suas referências Git alteradas.
- O caminho original de build comprovado é `C:\Windows\System32\livro-receitas`, com essa capitalização. A cópia temporária também concluiu o build nativo. PowerShell: usar `npm.cmd`.
- Next.js 16.4.3, React 19.3.1 e OpenNext 1.20.13 preservados. Não houve necessidade de WSL.
- Ajuste de código limitado ao executor Playwright: Chrome no Windows e variável opcional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Nenhuma alteração no MP4, CSS do checkout, seleção inicial de cartão, textos, callbacks ou configurações do Brick.

## Serviços e versão efetivamente publicados

URL: https://livro-receitas.joaolucasqtb.workers.dev

Conta Cloudflare confirmada por `wrangler whoami`: `48a86816b0ea33a5e9da7eb156dd98b1`.

- Versão em tráfego antes do trabalho: `b7c33f88-4d87-4a2b-b943-5b61455f5db0`.
- Única publicação desta etapa: alteração de configuração, herdando os demais bindings e preservando o código, com `CHECKOUT_ENABLED=false`.
- Versão resultante, 100% do tráfego: `6ab04f67-b935-4d20-b2df-46c47ae2ae48`; deployment `941a09f4-b7bb-4574-96d5-95a9c053e823`.
- Antes da desativação, GET /api/checkout retornou `available:true`, `mode:sandbox`, valor 10, cartão de crédito/débito e sem bankTransfer.
- Após propagação, GET /api/checkout retornou `available:false`. A configuração mantém `MERCADOPAGO_MODE=sandbox` e `LIVE_PAYMENTS_ENABLED=false`.
- Não foi executado o deploy que habilita produção. Não se usou deploy:sandbox ou deploy:vitrine para ativar vendas reais.

## D1 e R2 confirmados remotamente

- Binding ORDERS: receitas-premium-150-orders, ID `e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a`, conferido no serviço e na versão.
- `wrangler d1 migrations list` e `migrations apply --remote`: nenhuma pendência. Histórico contém `0001_commerce.sql` e `0002_order_environment.sql`.
- Consulta por ambiente: 1 pedido sandbox aprovado, 2 recusados e 3 criados; nenhum pedido de produção.
- Consulta de duplicidade: zero pedidos com mais de um purchase_approved. A comprovação anterior de webhook real e exatamente um purchase_approved do pedido sandbox aprovado foi preservada; não foi refeita a compra sandbox.
- Nenhum pedido, recibo ou evento foi apagado.
- Binding EBOOKS: receitas-premium-150-ebooks, confirmado no serviço e na versão.
- R2: nenhum domínio público e acesso r2.dev desabilitado.
- Objeto esperado pelo manifesto: `sha256/923c05444c26d527856f9effb76a3f8046ac08d507f57e6975db966672db7f55.pdf`.
- Download autenticado do objeto: 26.452.487 bytes; SHA-256 `923c05444c26d527856f9effb76a3f8046ac08d507f57e6975db966672db7f55`, idêntico ao manifesto de 167 páginas. A cópia de conferência ficou fora do Git, na pasta temporária.

## Verificações locais desta etapa

| Verificação | Resultado e limite |
| --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund | 358 pacotes instalados pelo lockfile na cópia isolada |
| npm run typecheck | Passou |
| npm run test:commerce | 16/16; D1 local via Miniflare e respostas controladas do provedor |
| npm run test:ui -- --grep 'checkout displays\|Meta' | 15/15 em 360px, 402px e desktop; SDKs de Mercado Pago e Meta simulados |
| npm run cloudflare:build | Next.js, TypeScript, OpenNext e validação do artefato passaram |
| npm run cloudflare:deploy:production -- --dry-run | Passou; 43 assets; 5873,59 KiB, gzip 1251,80 KiB; sem publicação ou cobrança |
| npm audit --audit-level=high | Zero vulnerabilidades; não foi executado audit fix |
| git diff --check | Passou antes dos commits |

A execução inicial do esbuild dentro do sandbox falhou por acesso a diretório ancestral; repetida fora do sandbox, passou. Não houve alteração de lógica financeira para passar nos testes.

A suíte selecionada verificou aprovação/pendência/recusa, bloqueio de envio duplo, largura do formulário simulado, opção inicial de cartão, consentimento, sandbox sem Pixel e Purchase sem reenvio após recarga. Esses testes não equivalem ao SDK real em produção ou ao recebimento na Meta. Eventos internos retornam 503 no servidor Next local sem bindings; a persistência foi testada separadamente no Miniflare e consultada remotamente no D1.

## Página publicada e checkout

Chrome real, sem enviar pagamento, em larguras 360, 402 e 1440: scrollWidth igual à largura da janela nos três casos e nenhum erro JavaScript capturado. A página apresentou a indisponibilidade temporária do checkout. Capturas em `work/screenshots/published-disabled-{360,402,1440}.png`, inspecionadas visualmente.

O vídeo publicado continua em `/product-video/1027-loop.mp4`. Preço de R$ 10, pagamento único e garantia de 7 dias preservados.

**Pendente:** legibilidade e comportamento dos campos/iframes do SDK real com credenciais de produção e Pix efetivamente disponibilizado pela conta. Não se exibiu Pix fictício: a última configuração ativa em sandbox não anunciava Pix, e isso não determina sua disponibilidade em produção.

## Credenciais e webhook de produção

A consulta inicial encontrou os quatro nomes, sendo ACCESS_TOKEN e WEBHOOK_SECRET do tipo Secret e PUBLIC_KEY/COLLECTOR_ID como variáveis. Isso comprova presença, não comprova credenciais reais ou vendedor de produção. Nenhum valor privado foi lido ou incluído neste relatório.

Com o checkout já desabilitado, o responsável deve abrir Cloudflare → Workers & Pages → livro-receitas → Settings → Variables and Secrets e configurar as quatro entradas correspondentes à mesma aplicação e conta de PRODUÇÃO, como Secrets:

1. MERCADOPAGO_ACCESS_TOKEN — credencial de produção.
2. MERCADOPAGO_PUBLIC_KEY — chave pública correspondente à aplicação de produção.
3. MERCADOPAGO_COLLECTOR_ID — identificador do vendedor real correspondente ao token; não reutilizar o vendedor de teste.
4. MERCADOPAGO_WEBHOOK_SECRET — segredo da configuração de notificações de produção.

No Mercado Pago Developers, confirmar no ambiente de produção o evento **Order (Mercado Pago)** e a URL:
https://livro-receitas.joaolucasqtb.workers.dev/api/webhooks/mercadopago

Não enviar os valores por chat. Avisar somente quando a configuração e a identidade do vendedor estiverem conferidas. Não há sessão do painel Mercado Pago disponível nesta execução. A presença de um segredo no Worker não prova que corresponda ao webhook de produção.

A assinatura HMAC, referência/pedido, vendedor, valor, moeda, isolamento e idempotência continuam implementados; não foram enfraquecidos.

Após essa confirmação, executar o comando documentado `npm.cmd run cloudflare:deploy:production` com a autenticação Cloudflare do operador disponível ao processo. O script define um XDG_CONFIG_HOME próprio quando não fornecido: preservar o diretório de autenticação já validado, sem copiar tokens ao repositório. Reconsultar versão e GET /api/checkout, exigindo available:true e mode:production.

## Compra real: não realizada

Não há compra real autorizada nem webhook de produção comprovados nesta etapa. Não foram usados dados inventados, cartões de teste em produção ou tentativas de cobrança.

Somente depois da liberação consistente, pedir ao responsável uma compra real de R$ 10 com comprador e meio de pagamento legítimos. Conferir, correlacionando pedido e tentativa no provedor e backend:

- aprovação; 10 BRL; vendedor real correto; ambiente production;
- recibo de webhook processado para o mesmo pedido do provedor;
- download autorizado no navegador do comprador;
- exatamente um purchase_approved e identificador estável do Purchase;
- recarga sem novo Purchase no mesmo armazenamento do navegador;
- pedidos sandbox permanecendo fora das consultas de vendas reais;
- Pix oferecido pela conta real e fluxo real, caso disponível; eventual desafio 3DS exige validação própria.

## Pixel 1150409944170993

**Implementado:** PageView, ViewContent, InitiateCheckout, Purchase e OfferCTAClick personalizado. A preferência existente do visitante foi preservada. O carregamento depende de produção habilitada e consentimento; sandbox permanece sem envio.

Purchase exige recibo do backend para pedido aprovado em produção, value 10, currency BRL e eventID estável derivado do pedido. Memória/localStorage impedem reenvio no cenário de recarga testado. Não se enviam nome, e-mail ou campos de pagamento no payload definido pela aplicação. Não foi instalado segundo Purchase nem API de Conversões.

**Testado localmente:** consentimento, bloqueio em sandbox, rejeição da medição e deduplicação após recarga, com SDK simulado.

**Confirmado no serviço Meta:** pendente. Nenhuma ferramenta conectada de Gerenciador de Eventos/Anúncios está disponível nesta sessão. Após a compra real, o responsável deve abrir o conjunto de dados existente 1150409944170993 → Testar eventos, permitir medição no site e confirmar PageView, ViewContent, InitiateCheckout e um Purchase com value 10/currency BRL. Não instalar Purchase adicional pela ferramenta de configuração de eventos.

O rastreamento é pelo navegador: depende de consentimento, rede, bloqueadores e permanência na página. O armazenamento pode ser apagado ou indisponível, e enfileirar um evento no SDK não comprova entrega na Meta. D1 não envia conversões à Meta.

## Preparação de anúncios, sem criação ou gasto

Proposta documental para revisão **após confirmar produção e Pixel**:

- Nome: 150 Doces | Site | Purchase | R$10.
- Objetivo: Vendas; destino/local de conversão: site; otimização: Purchase; conjunto de dados 1150409944170993.
- URL de destino: a URL do site acima; verificar na conta se há exigência de domínio próprio e usar um domínio controlado pelo vendedor quando necessário.
- Estado obrigatório ao criar: rascunho ou pausado; nenhuma campanha foi criada.
- Não definir orçamento, região/público ou criativos sem as escolhas do anunciante. Solicitar esses itens e acesso à conta somente quando a validação estiver concluída.

Texto A: “150 receitas de doces em um PDF com 10 capítulos e 167 páginas. Ingredientes e preparo organizados para consultar na cozinha. Conheça 150 Doces para Comer e Vender por R$ 10,00, em pagamento único. Garantia de 7 dias.”

Texto B: “Dos clássicos aos doces que ganharam as redes: conheça as 150 receitas do livro. PDF para consultar no celular ou computador, por R$ 10,00. Pagamento único e garantia de 7 dias.”

Título: “150 receitas por R$ 10,00”. Descrição: “PDF • pagamento único • garantia de 7 dias”. Criativos devem mostrar apenas conteúdo real, amostras e materiais autorizados. Não há escassez artificial ou promessa de faturamento.

## Pendências que exigem participação do responsável

1. Configurar com segurança as quatro entradas de produção e confirmar vendedor e webhook no painel Mercado Pago.
2. Após liberação do checkout, realizar a compra real autorizada de R$ 10 e manter o navegador para validar a entrega.
3. Confirmar recebimento e parâmetros dos quatro eventos no Gerenciador de Eventos da Meta.
4. Após essas confirmações, definir orçamento, público/região, criativos e acesso para criar, se desejado, campanha pausada para revisão.

O restante está concluído até esse limite: infraestrutura conferida, migrations sem pendências, PDF validado, testes/build/dry-run aprovados e relatório registrado. A ativação de produção e a confirmação comercial permanecem dependentes dos itens acima.
