# Checkout verde: apresentação e acessibilidade

## Onde está cada parte

- `components/landing.tsx`, `OfferSection`: seção `#checkout`, apresentação do produto, resumo, preço e FAQ.
- `components/checkout.tsx`: seleção crédito/Pix, e-mail do comprador no Pix, Payment Brick do cartão, estados, QR Code/Copia e Cola e download após confirmação.
- O cartão e seus campos são renderizados pelo SDK Mercado Pago JS v2. Sua aparência usa apenas as propriedades documentadas de `customization.visual`; não há seletores para classes internas geradas pelo SDK.
- A página usa CSS global em `app/globals.css`, com Tailwind v4 carregado pelo PostCSS. O checkout agora tem um CSS Module próprio, `components/checkout.module.css`, compartilhado pelos dois componentes.

## CheckoutTheme e componentes

A classe local `theme` define `--checkout-primary`, `--checkout-hover`, `--checkout-focus`, `--checkout-background`, `--checkout-surface`, `--checkout-border`, `--checkout-text`, `--checkout-secondary` e tokens de seleção/erro/radius. Esses valores só são herdados dentro de `#checkout`; a oferta, o restante da landing page e as outras rotas preservam as cores originais.

O módulo organiza resumo, painel de compra, métodos, dados, botões, avisos, QR Code e mensagens de confiança. O layout é uma coluna no celular e duas colunas a partir de 800px. Os campos usam 16px; os controles e botões têm pelo menos 44px de área de toque. Verde principal `#166534` com texto branco possui contraste superior a 4,5:1, também verificado por teste com os estilos computados.

O botão de copiar usa `button`, ícone Lucide já instalado, contorno verde e rótulo “Copiar código Pix (copia e cola)”. Mostra “Copiado!” por 3 segundos com anúncio `role=status`. Se o clipboard falhar, seleciona o código e orienta a cópia manual, sem tratar isso como erro de pagamento. O QR usa uma moldura branca com padding e borda.

## Escopo preservado

Nenhum arquivo de API, criação de Order, identidade do vendedor, validação, webhook ou autorização de download foi alterado neste commit de UI. As funções de submissão, os dados enviados e a consulta de status foram preservados. Mudanças no SDK limitam-se à apresentação do Brick: cores, espaçamento, bordas e remoção do título redundante.

Não houve publicação nem cobrança nesta refatoração. A versão funcional em produção continua disponível enquanto esta alteração é revisada.

## Validação automatizada

Na pasta `D:\livro-receitas-publicacao`:

```powershell
npm run build
npm run start -- --port 3105
```

Em outro terminal:

```powershell
$env:TEST_BASE_URL='http://localhost:3105'
npm run test:ui
npm run test:commerce
```

Os testes de UI interceptam APIs e simulam o SDK: não geram cobranças. As nove capturas em `tests/checkout-ui.spec.ts-snapshots` cobrem cartão, formulário Pix e Pix pendente em 360px, 402px e desktop. A imagem de QR usada nos testes é uma fixture de um pixel, sem valor de pagamento; os códigos de fixture não devem ser usados em um banco.

Os snapshots foram gerados com Chrome no Windows. Para atualizar as referências intencionalmente, use `npm run test:ui -- --update-snapshots` e revise as imagens. Em outra plataforma, mantenha referências específicas dessa plataforma após revisão.

## Conferência manual rápida

1. Use o inspector de testes: `npx playwright test tests/checkout-ui.spec.ts --project=360px --debug`. Ele permite pausar os estados simulados sem acessar pagamentos reais.
2. Confira o resumo, preço de R$ 10,00, pagamento único e ausência de assinatura. Compare a cor da oferta fora do checkout: deve continuar magenta.
3. Navegue com Tab, Espaço e setas entre os métodos. Confira seleção evidente, foco visível e campos exclusivos da opção escolhida.
4. No Pix pendente, confira moldura do QR, botão com ícone, feedback de cópia e alternativa manual quando a API de clipboard é negada.
5. Confira 320px, 360px, 402px e desktop sem rolagem horizontal. Amplie o navegador e confira a leitura.
6. Antes de publicar, confira o Brick real em ambiente autorizado, sem submeter cartão ou gerar Pix apenas para revisar o layout. Os mocks verificam a UI local, não substituem a renderização real dos campos do provedor.

Referência da personalização visual oficial: https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/additional-content/modify-css-variables

## Resultado desta entrega

- Build padrão Next.js/Turbopack e TypeScript: aprovados.
- 42 testes de interface aprovados, incluindo as nove capturas de referência. Depois da revisão das referências, os 15 testes de UI/visual do checkout passaram também sem `--update-snapshots`.
- 21 testes de backend aprovados, sem mudança de implementação de pagamento.
- Conferência adicional do SDK real em localhost, usando somente a configuração pública já existente: inicialização do Brick em 360px, botão verde e ausência de rolagem horizontal. A captura local ainda mostra o indicador de carregamento dos campos hospedados; essa conferência não certifica que todos os campos terminaram de carregar. O endpoint de pagamento foi bloqueado no navegador de teste, com zero requisições de pagamento. Captura local em `work/checkout-real-card-360px.png`.
- Comparação literal dos blocos `post`, `submitPix`, `refresh` e `onSubmit`: preservados. Nenhum arquivo de `lib` ou `app/api` mudou no commit visual.
- Nenhuma publicação, alteração de configuração remota ou cobrança realizada nesta entrega.
