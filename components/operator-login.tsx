"use client";
import { useState } from "react";
import styles from "./management-dashboard.module.css";
export function OperatorLogin() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className={styles.app}>
      <main
        style={{
          maxWidth: 440,
          width: "100%",
          margin: "10vh auto",
          padding: 22,
        }}
      >
        <p className={styles.eyebrow}>RECEITAS PREMIUM · GESTÃO</p>
        <section className={styles.panel}>
          <h1>Bem-vindo de volta.</h1>
          <p>Entre para acompanhar suas vendas e sua operação.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/admin/session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, password, remember }),
                });
                const data = (await response.json()) as { error?: string };
                if (!response.ok)
                  throw Error(data.error || "Não foi possível entrar.");
                location.assign("/admin");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input
                name="username"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label style={{ marginTop: 18 }}>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={256}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Manter conectado por sete dias neste aparelho
            </label>
            <button disabled={busy} style={{ width: "100%" }}>
              {busy ? "Entrando…" : "Entrar no painel"}
            </button>
          </form>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </section>
        <p className={styles.muted}>
          Primeiro acesso? Entre uma vez pelo{" "}
          <a href="/admin/acesso/entrar">
            acesso administrativo de configuração
          </a>{" "}
          e cadastre seu e-mail e senha em Central de operação → Minha conta.
        </p>
      </main>
    </div>
  );
}
export function OperatorAccount() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [current, setCurrent] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <section className={styles.panel}>
      <h2>Minha conta</h2>
      <p>
        Cadastre seu login uma vez. Para alterar uma conta já cadastrada,
        informe também a senha atual.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          setError("");
          try {
            const r = await fetch("/api/admin/account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email,
                password,
                currentPassword: current,
              }),
            });
            const d = (await r.json()) as { error?: string };
            if (!r.ok) throw Error(d.error || "Não foi possível salvar.");
            setPassword("");
            setCurrent("");
            setMessage(
              "Conta salva. Nos próximos acessos, use seu e-mail e senha.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className={styles.formGrid}>
          <label>
            E-mail de acesso
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Senha atual · para alteração
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
        </div>
        <button disabled={busy}>
          {busy ? "Salvando…" : "Salvar minha conta"}
        </button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
