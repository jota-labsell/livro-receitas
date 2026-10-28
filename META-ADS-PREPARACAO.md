# Meta Ads — preparação sem ativar gastos

## Configuração da campanha

| Campo | Valor preparado |
| --- | --- |
| Objetivo | Vendas |
| Local de conversão | Site |
| Evento de otimização | Purchase |
| Pixel/conjunto de dados | 1150409944170993 |
| Destino | https://livro-receitas.joaolucasqtb.workers.dev/ |
| Produto | 150 Doces para Comer e Vender — PDF, R$ 10, pagamento único |
| Estado inicial | Rascunho ou pausado; nenhuma campanha criada ou ativada nesta entrega |

Nomes sugeridos: campanha `Vendas | 150 Doces | Site | Purchase`; conjunto `150 Doces | Purchase | Definir público`; anúncios `A01 | Receitas em PDF` e `A02 | Livro na cozinha`.

## Duas opções de anúncio

**A01 — texto:** Conheça 150 receitas de doces com fotos e passo a passo, reunidas em um livro digital para consultar na cozinha. PDF por R$ 10, em pagamento único e sem assinatura. Veja as páginas e os detalhes no site.

**Título:** 150 receitas em PDF por R$ 10

**A02 — texto:** Para preparar para você ou explorar seu cardápio de doces: conheça o livro 150 Doces para Comer e Vender. São 150 receitas em PDF, por R$ 10. Pague com Pix ou cartão e baixe após a confirmação do pagamento.

**Título:** Doces para comer e vender

CTA sugerido: `Saiba mais`. Textos não prometem renda, lucro, resultados garantidos ou envio de material além do PDF anunciado. A arte ou o vídeo do anúncio ainda precisa ser escolhido e aprovado pelo responsável.

## Parâmetros de URL

No campo de parâmetros de URL do anúncio:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign=150_doces_r10&utm_content={{ad.id}}&utm_term={{adset.id}}
```

Os identificadores dinâmicos permitem relacionar anúncio e conjunto sem depender de alterações de nome. Conferir a substituição dos parâmetros na prévia do Gerenciador antes de publicar. Não colocar e-mail, telefone ou outros dados pessoais nas UTMs.

## Conferência humana do recebimento na Meta

1. Abra o Gerenciador de Eventos da empresa correta e selecione o conjunto de dados/Pixel `1150409944170993`.
2. Entre em **Testar eventos**, informe a URL do site e abra a página pela ferramenta. Na página, permita a medição somente se essa for sua escolha para o teste.
3. Visualize a oferta e entre no checkout, sem gerar cobrança. Confira `PageView`, `ViewContent` e `InitiateCheckout` e seus parâmetros. Ausência de consentimento ou bloqueadores pode impedir o envio.
4. Para `Purchase`, consulte a atividade/histórico da compra real já realizada. Não gere compra, clique em simulador ou dispare evento manual apenas para produzir uma conversão. Se não houver evento histórico, a validação do recebimento de Purchase permanece pendente até uma compra legítima futura consentida.
5. No evento legítimo, confira `value=10`, `currency=BRL`, origem navegador e identificador estável, sem repetições para o mesmo pedido. O evento interno `purchase_approved` do D1 não é comprovação de recebimento na Meta.

## Escolhas e acessos ainda necessários

- Conta de anúncios, permissões ao conjunto de dados e identidades da Página/Instagram.
- Orçamento, público, região, período, posicionamentos e estratégia de lance a definir pelo responsável.
- Materiais do anúncio, formatos, direitos de uso e aprovação final dos criativos.
- Forma de cobrança da conta de anúncios e eventuais verificações solicitadas pela Meta, incluindo domínio, se exigido para essa conta/URL.
- Confirmação no Gerenciador de Eventos de que os eventos chegaram, especialmente Purchase.

Não há API de Conversões nesta etapa. Nenhum anúncio, gasto ou envio de Purchase real foi criado pelo agente para validar a medição.
