# Publicar pelo GitHub

Se o Windows usar proxy, Git e Node podem precisar das variáveis HTTP_PROXY e
HTTPS_PROXY no processo do terminal. Elas devem apontar para o proxy já
configurado no Windows; não é necessário alterar firewall ou credenciais.
Nesta publicação o acesso direto falhava, mas o proxy do usuário funcionou.

O workflow `.github/workflows/deploy-production.yml` executa ao enviar commits
para `feat/150-doces-r10` quando a variável de Actions
`CLOUDFLARE_ACTIONS_DEPLOY=true` estiver configurada, ou manualmente por Actions
nessa mesma branch. Sem essa ativação, pushes não iniciam um segundo deploy.
Ele testa comércio/acesso/diagnóstico, gera o Worker em Linux, publica pelo
script de produção existente e verifica que a API do painel exige login.
Não aplica migrations, não altera credenciais, não gera cobranças e não envia
eventos à Meta. A migration de acesso precisa existir, como já ocorre na
produção verificada pelo operador.

No repositório GitHub, em Settings → Secrets and variables → Actions, são
necessários os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
O token deve poder publicar o Worker existente e consultar o D1 vinculado,
pois o script confere as tabelas antes de publicar. Não usar o token do
Mercado Pago, da Meta ou a credencial administrativa do e-book para isso.
Os secrets de pagamentos/Meta continuam no Worker e não entram no build.

Na publicação de 30/10, a consulta confirmou que esses secrets ainda não
estavam cadastrados no GitHub. Também confirmou integrações nativas Workers
Builds e Pages no repositório. Por isso o deploy automático de Actions fica
desativado até a configuração explícita, evitando publicações concorrentes.
A publicação do painel no Worker foi concluída pelo terminal autenticado;
não dependeu de configurar ou alterar essas integrações existentes.

Para copiar os novos arquivos para a cópia em Projetos:

```powershell
Set-Location "$env:USERPROFILE\Projetos\livro-receitas"
node C:\Windows\System32\livro-receitas\scripts\install-meta-panel.mjs
```

Depois, revise `git status` e envie o código à branch acima. Não inclua
`work/`, arquivos `.env`, credenciais, caches ou o PDF privado. O instalador
preserva a configuração e o estado de produção da cópia em Projetos.

No GitHub, abra Actions → Publicar produção na Cloudflare para acompanhar.
Upload do código, execução do workflow e publicação são etapas distintas:
apenas um deploy concluído e a verificação da rota comprovam esta publicação.
