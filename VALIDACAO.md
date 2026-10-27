# Validação da oferta de R$ 10

- TypeScript: aprovado.
- Next.js production build e OpenNext Cloudflare build: aprovados.
- Wrangler deploy --dry-run: aprovado; bundle comprimido de aproximadamente 1,1 MiB. Nenhum deploy de produção realizado.
- D1 local: migration aplicada; R2 local: objeto do livro verificado e enviado.
- Backend: **9 testes aprovados** em D1/Miniflare, com provedor controlado. Incluem concorrência/idempotência, divergência de valor/moeda/conta/pedido/produto/modo, perda de resposta, rejeição, estorno, ordenação dos eventos, HMAC e deduplicação de compra.
- Interface no runtime real do Worker local: **18 testes aprovados**, em 360px, 402px e desktop de 1440px. Galeria, três blocos, preço, CTAs, FAQ, foco, pausa, movimento reduzido e bloqueio da entrega gratuita conferidos. Os cenários de aprovado/pendente/recusado usam um substituto do SDK apenas no teste de interface.
- PDF: 167 páginas, 26.452.487 bytes; SHA-256 `923c05444c26d527856f9effb76a3f8046ac08d507f57e6975db966672db7f55`. Capa e páginas 7, 23, 39, 55, 71, 119 e 151 geraram as amostras. Galeria usa páginas 23, 39 e 71.
- Contraste calculado sobre branco: botão magenta 5,22:1; roxo 10,10:1; texto secundário 6,33:1. Teclado e foco verificados; isso não representa auditoria completa de acessibilidade.
- PDF completo, credenciais, arquivos de ambiente, caches, logs e artefatos temporários fora do Git. O PDF também ficou fora dos assets e do pacote do Worker.

## Bloqueios antes da cobrança

Não há credenciais Mercado Pago no ambiente. O sandbox oficial **não foi executado** e não é substituído pelos testes acima. A consulta de D1 remoto retornou erro de autenticação Cloudflare 10000; é preciso liberar o acesso à conta/base correta, preencher o ID real e aplicar a migration remota. O checkout e as cobranças reais permanecem desabilitados.

O roteiro de configuração e da matriz oficial de sandbox está em [CLOUDFLARE.md](CLOUDFLARE.md). O PDF deve continuar em R2 privado. Nenhuma aprovação foi simulada em produção e nenhum arquivo completo foi publicado.

## Atualização da demonstração

Corrigido o desaparecimento das amostras quando o PDF privado não estava disponível no R2. A vitrine agora usa um manifesto público das amostras; checkout e download continuam exigindo suas verificações privadas. Adicionadas seção “O que você recebe”, composição de páginas, quatro blocos fotográficos e loop maior com MP4/H.264 e WebM.

Build Next.js/OpenNext aprovado. Os **18 testes de interface passaram no Worker local sem nenhum binding R2 ou D1**, reproduzindo a configuração que fazia as amostras desaparecerem. A reprodução atravessou o fim do vídeo e reiniciou o loop, e a pausa e o movimento reduzido foram conferidos nas três larguras.

A seção de depoimentos por prints do Instagram contém os três arquivos fornecidos pelo usuário em `Desktop.rar`: cookies da Juliana, brownie e morangos. Os PNGs foram copiados sem alteração, com hashes idênticos aos arquivos recebidos. A seção aparece logo após a headline, com ampliação e retorno do foco por teclado. Os 18 testes de interface e o build Next.js/OpenNext passaram após a inclusão. O print de brinquedos foi substituído e não faz parte da oferta.

## Headline e vídeo 1027.mp4

Aplicada a referência visual à headline: composição centralizada, fonte Baloo 2 local em peso 800, destaque de “150 receitas” e menção explícita aos doces virais do TikTok e Instagram. Os depoimentos aprovados continuam logo após a headline.

O vídeo enviado `1027.mp4` substitui a animação anterior na apresentação principal. Foi convertido de HEVC/1080×1920 para H.264/720×1280, mantendo 20 segundos e todos os quadros visuais, sem áudio, com reprodução automática em loop. O arquivo otimizado ocupa 1.443.518 bytes. A origem é identificada pelo SHA-256 no manifesto público do vídeo. A apresentação mantém o quadro completo em 9:16, com pausa, alternativa estática para movimento reduzido e botão de reprodução quando o navegador bloquear autoplay.

Build Next.js/OpenNext e os **18 testes de interface aprovados** nas larguras 360px, 402px e 1440px. Os testes conferiram o novo texto, a fonte de vídeo `/product-video/1027-loop.mp4`, as dimensões 720×1280, a duração de 20 segundos, o reinício após o fim e a pausa.
