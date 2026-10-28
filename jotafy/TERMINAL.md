# Prompt para concluir a conexão

Implemente e publique o monitor JotaFy já preparado na branch feat/jotafy-monitor do repositório jota-labsell/livro-receitas. Leia jotafy/README.md. Preserve as novas alterações da produção ao integrar. Não crie cobranças e não altere credenciais do Mercado Pago.

1. Confira a ponta remota da branch e integre sem descartar arquivos locais.
2. Rode os testes financeiros e do Worker documentados.
3. Aplique a migration 0003 no D1 correto. Não apague tabelas.
4. Gere e guarde uma chave própria JOTAFY_TOKEN de 64 hex em ambiente seguro, sem exibi-la em logs/chat. Configure o secret no Worker jotafy.
5. Publique o Worker separado e confirme HTTP 401 sem chave e 200 com chave em /dashboard. Confira os totais por produção e horário de Brasília.
6. Faça build e deploy PRODUCTION do site para adicionar registro de eventos futuros. Preserve flags e checkout publicado; nenhum deploy sandbox.
7. Forneça a URL do Worker e oriente o responsável a transferir a chave para o APK de forma privada, usando o gerenciador de senhas. Não cole a chave no chat.
8. Confira notificações apenas com eventos reais futuros ou fixtures locais; não gere compras falsas em produção. Informe as limitações do serviço Android e a necessidade de FCM para push contínuo.

O APK entregue é uma versão de avaliação assinada, Android 8+. Não foi validado em aparelho físico. Não publique anúncios nem realize cobranças neste trabalho.
