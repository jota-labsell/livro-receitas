> Versao 2.0: veja [a entrega, o APK de previa e a configuracao Firebase](UPGRADE-2.0.md). As instrucoes abaixo registram a versao inicial 1.0.

# JotaFy — monitor Android de vendas

Primeira versão nativa Android 8+, sem credenciais de Mercado Pago no APK.

## Recursos
- Hoje, últimos 7 e 30 dias de calendário, em Brasília.
- Quantidade de vendas aprovadas e receita bruta; reembolsadas/contestadas ficam fora do total atual.
- Métodos mais usados; vendas anteriores à instrumentação são “não informado”.
- Resumo CSV exportado pelo seletor de arquivos Android.
- Últimos 25 eventos: Pix gerado, aprovação, recusa, cancelamento, reembolso e contestação.
- Notificações locais por consulta a cada minuto, com serviço visível ativo. Primeira conexão estabelece um cursor e não dispara alertas antigos. Reconexão retoma eventos ainda não vistos em lotes de 100.
- Chave do monitor criptografada no dispositivo usando Android Keystore; backup desativado; HTTPS obrigatório, sem redirecionar a chave a outra origem.

## Limites desta versão
Não é push FCM. Android pode suspender/parar o serviço; no Android 15, serviços de sincronização têm limite de execução em segundo plano (até 6h em 24h). O app trata o timeout e pode ser reaberto para retomar. Não promete alertas imediatos com app forçado a parar ou sem internet. Para monitoramento contínuo, implementar FCM com projeto Firebase e registro seguro dos dispositivos em etapa posterior.

Sem extrato líquido, taxas, saldo Mercado Pago, múltiplos lojistas ou dados pessoais de compradores. O evento Pix é registrado somente após resposta autoritativa válida com código Pix. Eventos antigos não são reconstruídos. Repetições do mesmo estado da mesma tentativa são ignoradas. Valor e resumo não equivalem ao saldo disponível na conta.

## Ativar no ambiente real (Codex do terminal)
A implementação foi preparada em branch separada `feat/jotafy-monitor`. Antes de integrar, confira alterações novas na branch de produção e preserve-as. Não sobrescreva o checkout atual.

1. Revise e integre a branch. Execute `npm ci` e `npm run test:commerce`.
2. Execute `npx wrangler d1 migrations apply receitas-premium-150-orders --remote` na raiz do projeto. Migration 0003 cria somente a tabela do monitor.
3. Gere uma chave aleatória de 32 bytes (64 caracteres hexadecimais) em ambiente seguro. Guarde-a em gerenciador de senhas, sem registrar no Git ou no chat.
4. Na pasta `jotafy/server`, execute `npx wrangler secret put JOTAFY_TOKEN`, colando a chave somente no prompt oculto da ferramenta. Publique com `npx wrangler deploy`. Não usar a chave do Mercado Pago.
5. Na raiz, faça `npm run cloudflare:build` e `npm run cloudflare:deploy:production`, com a autenticação Cloudflare já validada. Isso adiciona os eventos ao fluxo autoritativo existente; não habilitar sandbox sobre produção.
6. Instale o APK no Android. Abra “Conexão e chave de acesso”, informe a URL HTTPS retornada pelo deploy do Worker jotafy (sem caminho) e a chave do monitor. Permita notificações e toque “Ativar notificações”.
7. Confira resumo e histórico em relação ao D1. A primeira consulta só recebe eventos posteriores como notificações. Não crie cobrança só para teste sem autorização do responsável.

Se perder o aparelho, troque JOTAFY_TOKEN no Worker e atualize os dispositivos autorizados. A chave dá acesso de leitura ao monitor, não permissão para efetuar cobranças.

## Build e testes
- `npm run test:commerce` na raiz: testes financeiros e evento único de Pix/aprovação.
- `node --test jotafy/server/worker.test.mjs`: autenticação, isolamento sandbox/produção, agregados e cursor.
- Android SDK 35, Java 17+, Gradle 8.11.1: `gradle -p jotafy/android assembleDebug`.
- APK debug é instalável para avaliação. Para distribuição duradoura, gerar release com chave de assinatura própria guardada pelo responsável; não compartilhar keystore em repositório. Não houve teste em aparelho físico nesta execução.

## Estado de entrega
Código, migration, APK (quando build concluído) e testes locais. A API e instrumentação ainda precisam de publicação autenticada no ambiente real. Sem isso, o APK não recebe suas vendas. Nenhuma cobrança ou alteração remota foi realizada para criar o app.
