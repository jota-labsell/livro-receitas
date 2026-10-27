import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
const errors = [];
if (
  !config.d1_databases?.[0]?.database_id ||
  config.d1_databases[0].database_id === "00000000-0000-0000-0000-000000000000"
)
  errors.push(
    "Provisionar D1, substituir o ID e aplicar migrations/0001_commerce.sql.",
  );
for (const key of [
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_PUBLIC_KEY",
  "MERCADOPAGO_WEBHOOK_SECRET",
  "MERCADOPAGO_COLLECTOR_ID",
])
  if (!process.env[key])
    errors.push(
      `${key}: precisa ser configurado no ambiente seguro do Worker.`,
    );
console.log(
  "Este check local não lê segredos de produção nem comprova testes no sandbox.",
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Entradas locais presentes. Conferir bindings e executar a matriz oficial de sandbox antes de habilitar produção.",
  );
