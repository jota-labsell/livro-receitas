# Publicar pelo GitHub

O workflow `.github/workflows/deploy-production.yml` executa ao enviar commits
para `feat/150-doces-r10`, ou manualmente por Actions nessa mesma branch.
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

Esta configuração não prova que os secrets já estejam cadastrados no GitHub.
Sem acesso à rede, o agente não pôde consultar o repositório remoto ou
verificar uma integração nativa Workers Builds já existente na Cloudflare.
Se ela estiver ativa, escolha um único caminho de deploy para evitar duas
publicações concorrentes para o mesmo commit.

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
