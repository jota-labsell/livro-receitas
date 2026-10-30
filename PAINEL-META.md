# Painel de diagnóstico da Meta

Endereço: `/admin/meta`. Entre com a mesma sessão administrativa do painel
de recuperação. Um link no painel de pedidos abre o diagnóstico.

Para copiar a credencial e abrir diretamente a Meta, execute
`npm.cmd run meta:painel`. Sem sessão, o endereço abre o login específico
`/admin/meta/entrar`; após entrar, o destino é `/admin/meta`.
O comando `acesso:painel` continua abrindo o painel de recuperação.

O painel mostra Pixel, versão da Graph API, presença do secret, ativação da
CAPI, presença das tabelas e últimas 20 compras aprovadas, com horário de
Brasília. O status de envio refere-se somente ao servidor. Não consulta a
conta de anúncios nem os eventos recebidos diretamente pelo Pixel.

## Teste

1. No Gerenciador de Eventos, selecione o Pixel `1150409944170993`.
2. Abra **Eventos de teste** e copie o código para testar eventos do servidor.
3. Cole no painel e clique em **Enviar evento de teste**.
4. Confira HTTP, `events_received`, código de erro e identificador de
   rastreamento. Em caso de sucesso, procure o Purchase na aba de testes.

O endpoint exige sessão administrativa, origem canônica e limites de envio.
O token fica somente no Worker. O código de teste é obrigatório e não é
persistido. O evento usa uma referência aleatória e não inclui comprador,
pedido, cookie de publicidade ou cobrança. Não escreve no histórico de vendas
ou na fila de produção. Nunca remove o código para enviar uma compra fictícia.

`events_received: 1` significa que a Meta reconheceu o recebimento; não
significa venda atribuída à campanha. O fluxo automático das novas compras
está descrito em [META-AUTOMATICO.md](META-AUTOMATICO.md).

Erros do provedor são reduzidos a campos diagnósticos seguros. Mensagens e
corpos brutos não são exibidos. O teste não exige META_CAPI_ENABLED=true,
mas exige META_CAPI_ACCESS_TOKEN no Worker. Não mostra nem edita o token.

## Instalar na cópia do operador

No PowerShell em `C:\Users\João\Projetos\livro-receitas`:

```powershell
node C:\Windows\System32\livro-receitas\scripts\install-meta-panel.mjs
npm.cmd run test:meta
npm.cmd run publicar:acesso
```

O instalador copia os arquivos do painel e do envio automático, adiciona os
testes ao package.json e guarda cópias anteriores em work/meta-panel-backup.
Não copia credenciais ou estado de publicação. A configuração do Worker e
cron é atualizada. O diagnóstico funciona sem migrations Meta, mas o envio
automático exige 0007 e 0009, conforme META-AUTOMATICO.md.

Fonte primária para test_event_code e resposta: SDK oficial da Meta,
https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py

## Validação local

Os testes de API cobrem autenticação/origem, consulta com e sem tabelas
Meta, código obrigatório, payload isolado, erros sem exposição de credencial
e cota de envio. TypeScript passou. A tela foi exercitada com respostas
simuladas em Chrome a 402px e 1440px: formulário, resposta e ausência de
rolagem horizontal da página. Capturas em work/meta-panel-preview.
O instalador foi executado em uma cópia de teste e preservou o arquivo de
credencial e os scripts existentes. Esses testes não enviam eventos reais à
Meta. O primeiro teste remoto exige publicação e código da aba Eventos de teste.

A regressão de transporte também roda o código real em workerd/Miniflare,
com a saída HTTP interceptada: confirma que a requisição chega ao endpoint e
que redirecionamentos não são seguidos. Workers não aceita `redirect: error`;
o transporte usa `manual` e trata respostas 3xx explicitamente.
Referência: https://developers.cloudflare.com/workers/runtime-apis/request/
