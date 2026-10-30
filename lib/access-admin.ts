import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CommerceError, hash, type CommerceEnv } from "./commerce";
import { limitedProductAction } from "./product-access";

export const ADMIN_COOKIE = "__Host-recipe-support";
export type AccessAdminEnv = CommerceEnv & { EBOOK_ADMIN_KEY?: string };
const key = (env: AccessAdminEnv) => {
  if (!env.EBOOK_ADMIN_KEY || !/^[a-f0-9]{64}$/.test(env.EBOOK_ADMIN_KEY))
    throw new CommerceError(503, "Acesso administrativo ainda não configurado.");
  return env.EBOOK_ADMIN_KEY;
};
const mac = (env: AccessAdminEnv, text: string) => createHmac("sha256", key(env)).update(text).digest("hex");
const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a), "hex"), Buffer.from(hash(b), "hex"));
function signedSession(env: AccessAdminEnv, session?: string) {
  if (!session || session.length > 200) throw new CommerceError(401, "Entre na área de atendimento.");
  const [nonce, expiry, signature, extra] = session.split(".");
  if (extra !== undefined || !/^[a-f0-9]{32}$/.test(nonce || "") || !/^\d{13}$/.test(expiry || "") || !/^[a-f0-9]{64}$/.test(signature || '') || !equal(mac(env, `${nonce}.${expiry}`), signature) || Number(expiry) <= Date.now() || Number(expiry) > Date.now() + 7 * 86400000)
    throw new CommerceError(401, "Sua sessão administrativa expirou.");
  return { nonce, expiry: Number(expiry), actor: "support:" + hash(nonce).slice(0, 16) };
}
export async function verifyAccessAdmin(env: AccessAdminEnv, session?: string) {
  const parsed = signedSession(env, session);
  const row = await env.ORDERS?.prepare('SELECT expires_at FROM operation_admin_sessions WHERE nonce_hash=?')
    .bind(hash(parsed.nonce)).first<{expires_at:number}>();
  if (!row || row.expires_at !== parsed.expiry || row.expires_at <= Date.now()) throw new CommerceError(401, 'Sua sessão administrativa expirou.');
  return parsed.actor;
}
export async function issueAdminSession(env: AccessAdminEnv, lifetime: number, kind: 'key' | 'password', account?: {password_hash:string;salt:string}) {
  const nonce = randomBytes(16).toString('hex'), now = Date.now(), expiry = now + lifetime * 1000;
  const text = `${nonce}.${expiry}`;
  const session = `${text}.${mac(env,text)}`;
  if (!env.ORDERS) throw new CommerceError(503, 'Login indisponível.');
  const insert = account
    ? env.ORDERS.prepare('INSERT INTO operation_admin_sessions(nonce_hash,actor,kind,created_at,expires_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM operation_account WHERE id=1 AND password_hash=? AND salt=?)')
      .bind(hash(nonce), 'support:' + hash(nonce).slice(0,16), kind, now, expiry,account.password_hash,account.salt)
    : env.ORDERS.prepare('INSERT INTO operation_admin_sessions(nonce_hash,actor,kind,created_at,expires_at) VALUES(?,?,?,?,?)')
      .bind(hash(nonce), 'support:' + hash(nonce).slice(0,16), kind, now, expiry);
  const results = await env.ORDERS.batch([
    env.ORDERS.prepare('DELETE FROM operation_admin_sessions WHERE expires_at<=?').bind(now),
    insert,
  ]);
  if(results[1].meta.changes !== 1) throw new CommerceError(401,'E-mail ou senha inválidos.');
  return {session,lifetime};
}
export async function revokeAdminSession(env: AccessAdminEnv, session?: string) {
  let parsed;
  try { parsed = signedSession(env,session); } catch { return; }
  if (!env.ORDERS) throw new CommerceError(503, 'Não foi possível encerrar a sessão.');
  await env.ORDERS.prepare('DELETE FROM operation_admin_sessions WHERE nonce_hash=?').bind(hash(parsed.nonce)).run();
}
export async function loginAccessAdmin(env: AccessAdminEnv, password: unknown, clientIp: string) {
  // Secret-keyed, daily rotating pseudonym. No raw IP or submitted key is persisted.
  const bucket = mac(env, `login:${new Date().toISOString().slice(0, 10)}:${clientIp}`);
  await limitedProductAction(env, bucket, 5, 15 * 60000);
  await limitedProductAction(env, "admin-login-global", 50, 15 * 60000);
  if (typeof password !== "string" || password.length > 128 || !equal(key(env), password))
    throw new CommerceError(401, "Credencial inválida.");
  return (await issueAdminSession(env, 3600, 'key')).session;
}
