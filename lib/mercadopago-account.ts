import { CommerceError, mp, requireReady, type CommerceEnv } from './commerce';

// Check the configured seller before reserving an attempt or creating any Order.
// Never infer a replacement seller from an Order or silently change configuration.
export async function assertProviderAccount(env: CommerceEnv, fetcher: typeof fetch = fetch) {
  requireReady(env);
  const account = await mp<{ id?: unknown }>(env, '/users/me', {}, fetcher);
  const id = account.id;
  const validId = typeof id === 'string'
    ? /^[1-9]\d*$/.test(id)
    : typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  if (!validId || String(id) !== env.MERCADOPAGO_COLLECTOR_ID) {
    console.warn(JSON.stringify({ event: 'payment_configuration_mismatch', check: 'collector' }));
    throw new CommerceError(503, 'Configuração de pagamento inconsistente. Nenhuma nova cobrança foi iniciada. Entre em contato com o suporte.');
  }
}
