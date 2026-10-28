## Atualização Orders

- 15 testes de backend passaram, incluindo seis cenários de Orders com dados simulados.
- 18 testes de interface passaram em 360px, 402px e desktop; os nove cenários de checkout foram repetidos após incluir Pix copia e cola e IDs de Orders.
- Credenciais do Mercado Pago não disponíveis no executor: sandbox oficial, webhook real e entrega remota ainda pendentes.
- Produção bloqueada no adaptador. Publicação de teste preparada por `cloudflare:deploy:sandbox`.
- Fluxo e instruções atuais em ORDERS-SANDBOX.md; as referências legadas abaixo não comprovam a nova integração no provedor.

# Validação da página de venda

## Sequência atual

1. Headline centralizada com 150 receitas e menção aos doces virais do TikTok e Instagram.
2. GIF do e-book imediatamente abaixo da headline.
3. Três depoimentos reais enviados pelo usuário, com ampliação.
4. Painel de benefícios: entregáveis, preparo, planejamento de renda extra e acesso no celular.
5. Garantia de 7 dias, pagamento único e condições de entrega.
6. Checkout Mercado Pago imediatamente depois das condições.
7. Conteúdo restante preservado após o checkout: apresentação detalhada do livro, categorias, páginas reais, FAQ e rodapé.

A ordem dos seis blocos principais é verificada diretamente no DOM pelos testes. A garantia de 7 dias foi autorizada pelo responsável pela oferta e está refletida nos Termos: pedido de reembolso pelo e-mail de atendimento em até 7 dias após a compra.

## GIF e imagens

O GIF principal é o arquivo `1027.gif` de `1027.zip`, copiado sem alteração para `public/product-video/1027-loop.gif`. São 400×711 pixels, 300 quadros, 20 segundos e repetição infinita. SHA-256: `f5fb19df08d553df32ba36548685206294b845f7f3c52b4fa3848b09b5d55c32`. O componente não usa player de vídeo: exibe GIF nativo, permite pausar com uma imagem estática e respeita movimento reduzido.

Os três PNGs dos depoimentos também preservam os bytes dos arquivos recebidos em `Desktop.rar`. O print de brinquedos foi substituído e não faz parte da oferta.

As amostras públicas do PDF continuam independentes da disponibilidade do arquivo privado no R2. O PDF completo de 167 páginas permanece fora do Git e dos assets públicos. Seu SHA-256 é `923c05444c26d527856f9effb76a3f8046ac08d507f57e6975db966672db7f55`.

## Checks executados

- TypeScript, build Next.js e build OpenNext/Cloudflare: aprovados.
- Checagem do artefato: nenhum PDF completo ou variável privada nos assets/pacote do Worker; os assets respeitam o limite de tamanho.
- **18 testes de interface aprovados** no Worker local, em 360px, 402px e 1440px: ordem dos blocos, prints ampliáveis, benefícios, garantia, preço, CTAs, FAQ, foco, GIF válido com loop, pausa e movimento reduzido.
- Estados de aprovado/pendente/recusado nos testes usam um substituto do SDK, somente na interface. A rota gratuita retorna 410 e o download sem compra permanece bloqueado.
- Os 9 testes financeiros em D1/Miniflare da implementação anterior seguem registrados na entrega; o backend de pagamento não foi alterado por esta revisão visual.

## Pendências de produção

O sandbox oficial do Mercado Pago não foi executado por falta de credenciais. D1 remoto ainda precisa do acesso correto, ID e migration. O checkout permanece desabilitado no comando de publicação da vitrine. A publicação via API deste ambiente retornou 401 anteriormente; um novo deploy no painel da Cloudflare aplica o commit atualizado. O roteiro está em [CLOUDFLARE.md](CLOUDFLARE.md).
