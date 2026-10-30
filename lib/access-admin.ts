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
export function verifyAccessAdmin(env: AccessAdminEnv, session?: string) {
  if (!session || session.length > 200) throw new CommerceError(401, "Entre na área de atendimento.");
  const [nonce, expiry, signature] = session.split(".");
  if (!/^[a-f0-9]{32}$/.test(nonce || "") || !/^\d{13}$/.test(expiry || "") || !signature || !equal(mac(env, `${nonce}.${expiry}`), signature) || Number(expiry) <= Date.now() || Number(expiry) > Date.now() + 3600000)
    throw new CommerceError(401, "Sua sessão administrativa expirou.");
  return "support:" + hash(nonce).slice(0, 16);
}
export async function loginAccessAdmin(env: AccessAdminEnv, password: unknown, clientIp: string) {
  // Secret-keyed, daily rotating pseudonym. No raw IP or submitted key is persisted.
  const bucket = mac(env, `login:${new Date().toISOString().slice(0, 10)}:${clientIp}`);
  await limitedProductAction(env, bucket, 5, 15 * 60000);
  await limitedProductAction(env, "admin-login-global", 50, 15 * 60000);
  if (typeof password !== "string" || password.length > 128 || !equal(key(env), password))
    throw new CommerceError(401, "Credencial inválida.");
  const text = `${randomBytes(16).toString("hex")}.${Date.now() + 3600000}`;
  return `${text}.${mac(env, text)}`;
}
