# JotaFy em producao — 28/10/2026

Monitor: https://jotafy.joaolucasqtb.workers.dev
Site: https://livro-receitas.joaolucasqtb.workers.dev

## Publicacao validada

- Migration 0003_jotafy.sql aplicada ao D1 receitas-premium-150-orders (e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a). Sem migrations pendentes.
- Worker jotafy: aaa38a1d-d96c-4efb-b2e9-46b4b1d5ed7c.
- Worker livro-receitas, pelo comando cloudflare:deploy:production: e8feba7f-da9f-491e-ab43-55e9e4db2127.
- /dashboard: 401 sem Authorization, 200 com a chave exclusiva do monitor, conferido novamente depois do deploy do site.
- Periodos de 1, 7 e 30 dias: limites de calendario em Brasilia conferidos; totais iguais ao D1 filtrado por production e status approved. Nesta verificacao, cada periodo tinha 1 venda e 1000 centavos de receita bruta, oriundos de registros preexistentes.
- Checkout apos deploy: available=true, mode=production, amount=10, cartao e Pix disponiveis. Medicao Meta enabled=true.
- Nenhuma cobranca criada nesta sessao. Credenciais do Mercado Pago preservadas.

## Integracao e testes

Integracao feita em clone isolado, preservando as alteracoes das branches feat/150-doces-r10 e feat/jotafy-monitor e os commits locais do clone D:/livro-receitas-producao-meta, incluindo 9ef26b8. Nenhuma pasta da outra sessao foi editada. Conflitos resolvidos preservando validacao do vendedor, Pix expirado, qrCodeBase64, medicao Meta e todos os testes recentes.

Aprovados: 22 testes financeiros; 1 teste do Worker; 4 testes de protecao de deploy; typecheck; 48 testes de interface em 360px, 402px e desktop; cloudflare:build e validacao do artefato (sem variaveis privadas compiladas ou PDF privado nos assets).

## Chave privada e celular

JOTAFY_TOKEN gerado com 32 bytes aleatorios e enviado somente ao secret do Worker jotafy. Nao esta neste repositorio, no chat ou nos logs. Copia local protegida por DPAPI do usuario Windows e ACL privada, em %LOCALAPPDATA%/JotaFy/jotafy-token.dpapi.

Execute %LOCALAPPDATA%/JotaFy/Copiar-chave.cmd na conta Windows que publicou. O atalho copia a chave para a area de transferencia sem imprimir seu valor. Guarde-a em seu gerenciador de senhas e use o gerenciador para transferi-la ao celular. DPAPI depende desta conta Windows e deste computador; mantenha uma copia no gerenciador de senhas.

No APK, abra Conexao e chave de acesso, informe a URL do monitor sem /dashboard e a chave privada. Permita notificacoes e ative o monitoramento.

A instrumentacao registra novos eventos confirmados pelo backend, apenas em producao. Eventos antigos nao sao reconstruidos; metodos antigos podem constar como nao informado. Nenhuma venda foi criada para testar notificacoes. O monitor usa consulta a cada minuto enquanto o servico esta ativo; o Android pode suspende-lo. Push continuo requer uma etapa posterior com FCM. A instalacao no celular foi informada pelo responsavel; nao houve teste fisico do aparelho nesta sessao.
