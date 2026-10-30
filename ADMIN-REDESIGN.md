# JotaFy / MetaTrack — auditoria e redesign administrativo

## Confirmação de projeto
- Repositório: `jota-labsell/livro-receitas`, branch base `feat/150-doces-r10`.
- Next.js 16 App Router, React 19, TypeScript, CSS Modules, Lucide.
- Frontend operacional: `app/admin` + `components/management-dashboard.tsx`, `components/operation-summary.tsx`, telas de diagnóstico Meta, acesso/atendimento e conta administrativa.
- Backend: Cloudflare Workers, D1, R2, Mercado Pago Orders, Meta Pixel e CAPI.
- API financeira, pagamentos, webhooks, autenticação, segredos e migrations preservados.

## Diagnóstico
1. Estilos claros e escuros sobrepostos na mesma CSS Module; faltava um design system administrativamente isolado.
2. Sidebar compacta e sem rótulos por padrão; rotas lógicas pouco evidentes.
3. Métricas sem dados de anúncios apareciam misturadas às métricas reais; reforçar ausência de integração sem inventar valores.
4. Funil com rótulos e barras pequenas; leitura ruim.
5. Gestão de produtos era um cartão com poucos dados e um formulário de Pixel.
6. Faltava busca local de campanhas, estados vazios consistentes e uma organização de editor.
7. Telas de Meta e atendimento mantinham identidade visual anterior.
8. Testes de painel exigiam atualização com os novos fluxos; não havia CI de design isolado.

## Capacidades reais e limites
- **Produto:** um produto digital configurado no código, não existe API de criação/edição de múltiplos produtos.
- **Editável pelo painel:** ID do Pixel e pausa do envio automático da CAPI. Salvamento continua em `POST /api/admin/operations`.
- **Somente leitura:** preço, meios de pagamento, checkout, entrega, acesso, integrações financeiras e segredos.
- **Relatórios:** receita e pedidos internos são reais. Investimento em anúncios, CPA, ROAS e lucro dependem de integrações ainda indisponíveis.
- **Atribuição:** por origem de sessão interna; não confundir com a atribuição da Meta.

## Plano por fases
1. [x] Auditar rotas e fontes de dados reais.
2. [x] Definir tokens administrativos dark/mint, estilos e blocos reutilizados.
3. [x] Reorganizar sidebar, breadcrumb, cabeçalho e filtros.
4. [x] Redesenhar indicadores, funil e visualização de faturamento, sem fabricar gastos.
5. [x] Adicionar catálogo de um produto, busca, modos de exibição e editor por seção.
6. [x] Harmonizar diagnóstico Meta, atendimento e login com o design.
7. [ ] Validar visualmente todos os tamanhos e estados interativos no CI.
8. [ ] Concluir TypeScript, testes, build e revisar logs.

## Testes e entrega
```sh
npm ci
npm run typecheck
npm run test:commerce
npm run test:access
npm run test:access:credential
npm run test:meta
npm run test:operations
npm run build
npx playwright install chromium
npm run test:management:ui
npm run test:meta:ui
npm run dev
```
Painel local: `http://localhost:3000/admin`. Requer sessão/credenciais legítimas do ambiente. O fluxo de QA da branch `design/jotafy-premium-workspace-20261030` não executa deploy. Faça revisão do diff e merge somente com autorização.
