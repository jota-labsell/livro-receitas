# Painel de diagnóstico da Meta

Endereço: `/admin/meta`. Entre com a mesma sessão administrativa do painel
de recuperação. Um link no painel de pedidos abre o diagnóstico.

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
significa venda atribuída à campanha. O painel não corrige a integração
automática de compras, que continua indicada como pendente.

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

O instalador copia somente os arquivos do painel, adiciona seu teste ao
package.json e guarda cópias anteriores em work/meta-panel-backup. Não copia
credenciais, estado de publicação ou configuração do Wrangler. O painel não
precisa de nova migration; se as tabelas Meta não existirem, informa isso e
continua exibindo as compras e permitindo o teste.

Fonte primária para test_event_code e resposta: SDK oficial da Meta,
https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event_request.py

## Validação local

Seis testes de API passaram: autenticação/origem, consulta com e sem tabelas
Meta, código obrigatório, payload isolado, erros sem exposição de credencial
e cota de envio. TypeScript passou. A tela foi exercitada com respostas
simuladas em Chrome a 402px e 1440px: formulário, resposta e ausência de
rolagem horizontal da página. Capturas em work/meta-panel-preview.
O instalador foi executado em uma cópia de teste e preservou o arquivo de
credencial e os scripts existentes. Esses testes não enviam eventos reais à
Meta. O primeiro teste remoto exige publicação e código da aba Eventos de teste.
