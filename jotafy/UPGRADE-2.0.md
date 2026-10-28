# JotaFy 2.0 — entrega e limites

## Download e instalacao

APK de avaliacao assinado: https://jotafy.joaolucasqtb.workers.dev/downloads/JotaFy-2.0-preview.apk

A previa tem nome **JotaFy Previa** e pacote **com.jotafy.app.preview**. Instala ao lado do aplicativo atual. Nao desinstale o original. Informe a mesma URL do monitor e sua chave para consultar os dados reais. Nenhuma chave foi incluida no APK.

**A chave de assinatura original nao foi localizada nesta maquina.** O APK 1.0 foi assinado por CN=JotaFy Development, O=JotaFy, C=BR, SHA-256 D4:E1:83:34:CA:D0:C6:B7:62:0E:6B:02:18:7D:B4:34:BE:78:CE:9A:19:7A:63:F2:20:B7:5E:3C:E9:30:D0:FA. A nova previa usa a assinatura de desenvolvimento local e um pacote diferente, explicitamente. Nao e uma atualizacao sobre o original.

O build release com pacote com.jotafy.app e versionCode 2/versionName 2.0.0 tambem esta preparado, sem assinatura enquanto a chave original estiver ausente. Para uma atualizacao real, recupere o keystore original e configure, fora do Git, JOTAFY_KEYSTORE, JOTAFY_STORE_PASSWORD, JOTAFY_KEY_ALIAS e JOTAFY_KEY_PASSWORD. O build recusa um certificado diferente do original. Nao troque a assinatura nem desinstale o original para contornar esse requisito.

## Identidade e interface

Verde profundo, lima, cartoes arredondados, tipografia legivel, simbolo original J com seta, SVG vetorial, launcher adaptativo e icone monocromatico de notificacao. Dashboard: receita bruta, vendas, ticket medio, Hoje/7/30 dias, curva diaria real, distribuicao por metodo com legenda e valores, historico e CSV. Estados vazios nao estimam vendas. Series diarias usam o calendario de Brasilia; dias sem aprovacoes aparecem como zero.

Erros aparecem dentro do app; ultima atualizacao explicita. O dado anterior permanece identificado pela data da ultima atualizacao. Detalhes de eventos sao buscados na API com autenticacao. Dados de compradores nao sao retornados. O armazenamento existente da chave usa o mesmo alias Android Keystore e as mesmas preferencias na variante original.

## Push: codigo pronto, Firebase ainda nao configurado

**Nao foi comprovada entrega de push em aparelho real.** O servidor retorna push.configured=false e POST /devices retorna 503 enquanto faltarem configuracoes. A previa sem Firebase permite dashboard e testes locais de som/notificacao; nao possui push ativo e nao mantem servico permanente. O aplicativo 1.0 instalado continua com seu comportamento anterior ate ser atualizado.

1. Crie/seleciona um projeto no Firebase Console e habilite a Firebase Cloud Messaging API HTTP v1 no Google Cloud.
2. Cadastre o aplicativo Android com applicationId **com.jotafy.app**. Baixe google-services.json para jotafy/android/app/google-services.json. Esse arquivo e configuracao publica Android, nao e credencial de servidor; esta ignorado para evitar commits acidentais do projeto.
3. Crie uma conta de servico restrita ao envio FCM nesse projeto (papel Firebase Cloud Messaging API Admin / permissao cloudmessaging.messages.create). Guarde o JSON em ambiente privado. Nao o envie ao chat, Git ou APK.
4. No Worker jotafy, configure **Secrets**:
   - FCM_SERVICE_ACCOUNT: o JSON da conta de servico.
   - FCM_TOKEN_ENCRYPTION_KEY: 32 bytes aleatorios em 64 hex, para cifrar os tokens de dispositivo no D1. Guarde uma copia segura; trocar essa chave exige recadastrar dispositivos ou migrar os tokens cifrados.
   - Preserve JOTAFY_TOKEN existente; nao use credenciais do Mercado Pago.
5. Configure a variavel FCM_PROJECT_ID com o project_id exato da conta de servico; a configuracao do Worker usa keep_vars. Confirme que a configuracao local nao apaga esse ID no proximo deploy.
6. Compile a variante original assinada corretamente. A previa com pacote .preview nao e registrada no projeto com.jotafy.app e deixa push desativado de proposito.
7. Abra Ajustes, ative push e permita notificacoes. O cadastro usa JobScheduler persistente com requisito de rede e backoff. onNewToken agenda renovacao; nenhum token de dispositivo aparece em logs.
8. Para teste real autorizado, receba um evento financeiro legitimo futuro; confira outbox e notificacao, toque no detalhe e valide o acesso. Nao gere cobrancas ou conversoes falsas para teste.

## Servidor e seguranca

Migration **0004_jotafy_push.sql** adiciona dispositivos e outbox; nao altera pedidos, preco ou checkout. O Worker JotaFy possui cron de um minuto que le eventos ja confirmados de jotafy_events. Nao houve mudanca no fluxo de aprovacao/entrega do site.

POST/GET /devices, DELETE /devices/:id e GET /events/:seq exigem a chave do monitor. Nao existe endpoint publico para disparar push. O unico download publico e o APK. Tokens FCM ficam cifrados com AES-GCM no D1; hash separado garante unicidade. A chave de monitor e vinculada por hash aos dispositivos; uma rotacao do monitor invalida o envio aos registros antigos.

Outbox unica por evento/dispositivo; leases evitam concorrencia; falhas temporarias usam backoff, Retry-After e limite de tentativas; tokens UNREGISTERED sao desativados. O Android tem deduplicacao persistente adicional para respostas ambiguas do FCM. Cadastro estabelece cursor atual, sem alertas retroativos. Eventos com mais de uma hora expiram; nao se promete entrega imediata ou recuperacao ilimitada. Cron adiciona ate aproximadamente um minuto antes do envio, alem das limitacoes de Android/rede/FCM. Nao ha consulta periodica em foreground service no novo app.

Ao desconectar, cadastro e pendencias do dispositivo sao removidos; o app preserva a conexao caso a remocao falhe para permitir nova tentativa. Preferencias sincronizam categorias permitidas. As notificacoes nao incluem dados pessoais e apresentam versao generica na tela bloqueada; ha opcao de ocultar valor tambem no titulo.

## Sons e canais

sale.wav e pix.wav foram sintetizados do zero pelo script jotafy/scripts/generate-sounds.mjs. Sem audio de terceiros. Venda usa confirmacao ascendente; Pix e curto e discreto. Apenas o canal Android toca o som; nao ha MediaPlayer adicional. Canais separados de aprovacao, Pix e outros, com variantes de som/vibracao. Preferencias nao tentam sobrescrever configuracoes que o usuario modificou no Android. Ha atalho para as configuracoes do sistema; silencioso e Nao Perturbe sao respeitados.

Botoes de teste sao **demonstracao local**, com IDs proprios e rotulo explicito; nao chamam o servidor financeiro nem a Meta.

## Validacao

- Seis testes integrados da API: autenticacao, periodos e agregados, cifragem e renovacao, preferencias, isolamento producao/sandbox, deduplicacao por evento/dispositivo, concorrencia, retentativas, tokens invalidos, rotacao e expiracao.
- 22 testes financeiros e quatro testes de protecao de deploy aprovados.
- Builds Android debug e release preparados; a previa e assinada, release original sem chave permanece unsigned.
- Teste instrumentado SmokeRunner preparado para privacidade, categorias, deduplicacao, armazenamento e capturas em telas pequenas e grandes. Capturas e instalacao fisica so podem ser afirmadas quando esse teste realmente executar.
- Sem teste em celular fisico, sem entrega FCM real, sem teste de atualizacao sobre 1.0 por falta do certificado privado original.
- A API em producao foi conferida com 401 sem chave e 200 autenticado. As series de 1/7/30 dias somam os mesmos totais do resumo real.
