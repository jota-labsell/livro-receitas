# JotaFy / MetaTrack — V3 reference implementation

## Visual source of truth
Use the **two screenshots supplied by the product owner in the conversation** as direct visual-composition references, not as assets to embed and not as ready-made mockups.

### Reference 1 — Dark analytics dashboard
- Charcoal/graphite shell, neutral surfaces, subdued separators.
- A compact KPI strip across the top, with clear typographic values.
- A prominent wide performance chart and narrower companion analytics.
- Functional chart colors (blue for revenue, orange for order volume, others for funnel stages).
- Campaign table and operational details below the analytical row.
- No bright green backgrounds, decorative gradients or fake ad expenditure.

### Reference 2 — Product management
- Dark top summary with a **light management canvas** underneath.
- White table/panels, clean search and actions, understated blue controls.
- The product editor uses a persistent section menu and categorized fields.
- Real single-product catalog. The product's name, price and delivery details are server-sourced or explicit project metadata.
- Only Meta Pixel and CAPI pause are editable here: no fake price, product-creation or payment controls.

## Changed surfaces
- `app/admin/admin-theme.css` — semantic neutral palette.
- `components/management-dashboard.module.css` — shell/sidebar/nav/filter components.
- `components/executive-overview.tsx` and `.module.css` — actual D1 data, KPI strip, dual-series chart with independent scales, campaign and funnel surfaces.
- `components/product-workspace.tsx` and `.module.css` — dark KPI summary, table-first white catalog, light editor and mobile stacked rows.
- `components/meta-diagnostics.module.css` — neutralized diagnostics.
- `components/access-admin.module.css` — neutralized support/login.
- `scripts/test-management-ui.mjs` — UI and responsive assertions.
- `.github/workflows/redesign-validation.yml` — branch CI with browser screenshots.

## Validation and safeguards
- Branch: `design/jotafy-graphite-v3-20261030`; PR #6, **draft**, production unchanged.
- CI: TypeScript, commerce and access tests, Meta/operations tests, Next.js build and Playwright at 360, 402, 768, 1440 widths. Check Actions for final result.
- The browser screenshot fixture is synthetic and must never be shown as real operational data.
- No changed API routes, payment rules, webhook handlers, secrets, migrations, Pixel code or conversion delivery.
- Missing spend/CPA/ROAS/lucro remain explicitly unavailable until trustworthy integrations exist.
- Local preview after configuring the required runtime: `npm ci`, `npm run dev`, open `http://localhost:3000/admin`.
