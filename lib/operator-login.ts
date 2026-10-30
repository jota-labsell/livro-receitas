import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { CommerceError, type CommerceEnv } from "./commerce";
import { limitedProductAction } from "./product-access";
type LoginEnv = CommerceEnv & { EBOOK_ADMIN_KEY?: string };
type Account = { email: string; password_hash: string; salt: string };
async function derive(password: string, salt: string) {
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const value = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 100000,
      salt: bytes.encode(salt),
    },
    key,
    256,
  );
  return Buffer.from(value).toString("hex");
}
export async function passwordMatches(account: Account, password: unknown) {
  const candidate =
    typeof password === "string" && password.length <= 256 ? password : "";
  const value = await derive(candidate, account.salt);
  return (
    timingSafeEqual(
      Buffer.from(value, "hex"),
      Buffer.from(account.password_hash, "hex"),
    ) && candidate.length > 0
  );
}
export async function accountLogin(
  env: LoginEnv,
  input: Record<string, unknown>,
  ip: string,
) {
  if (!env.EBOOK_ADMIN_KEY || !env.ORDERS)
    throw new CommerceError(503, "Login indisponível.");
  const bucket = createHmac("sha256", env.EBOOK_ADMIN_KEY)
    .update("password-login:" + ip)
    .digest("hex");
  await limitedProductAction(env, bucket, 5, 15 * 60000);
  await limitedProductAction(env, "password-login-global", 50, 15 * 60000);
  const account = await env.ORDERS.prepare(
    "SELECT email,password_hash,salt FROM operation_account WHERE id=1",
  ).first<Account>();
  const fallback = {
    email: "",
    salt: "dummy-constant-login-salt",
    password_hash: "0".repeat(64),
  };
  const valid = await passwordMatches(account || fallback, input.password);
  if (
    !account ||
    !valid ||
    typeof input.email !== "string" ||
    account.email !== input.email.trim().toLowerCase()
  )
    throw new CommerceError(401, "E-mail ou senha inválidos.");
  const lifetime = input.remember === true ? 7 * 86400 : 3600;
  const text =
    randomBytes(16).toString("hex") + "." + (Date.now() + lifetime * 1000);
  return {
    session:
      text +
      "." +
      createHmac("sha256", env.EBOOK_ADMIN_KEY).update(text).digest("hex"),
    lifetime,
  };
}
export async function saveAccount(
  env: LoginEnv,
  actor: string,
  input: Record<string, unknown>,
) {
  if (
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    !/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(input.email) ||
    typeof input.password !== "string" ||
    input.password.length < 12 ||
    input.password.length > 256
  )
    throw new CommerceError(
      400,
      "Informe um e-mail válido e senha de 12 a 256 caracteres.",
    );
  const previous = await env
    .ORDERS!.prepare(
      "SELECT email,password_hash,salt FROM operation_account WHERE id=1",
    )
    .first<Account>();
  if (previous && !(await passwordMatches(previous, input.currentPassword)))
    throw new CommerceError(401, "Confira sua senha atual.");
  const salt = randomBytes(32).toString("hex"),
    passwordHash = await derive(input.password, salt),
    now = Date.now();
  await env.ORDERS!.batch([
    env
      .ORDERS!.prepare(
        "INSERT INTO operation_account(id,email,password_hash,salt,updated_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,salt=excluded.salt,updated_at=excluded.updated_at",
      )
      .bind(input.email.trim().toLowerCase(), passwordHash, salt, now),
    env
      .ORDERS!.prepare(
        "INSERT INTO operation_audit(id,actor,action,created_at) VALUES(?,?,?,?)",
      )
      .bind(crypto.randomUUID(), actor, "update_operator_account", now),
  ]);
}
