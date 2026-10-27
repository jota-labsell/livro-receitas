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
