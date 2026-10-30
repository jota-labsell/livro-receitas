import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { env } from "@/lib/http";
import { MetaDiagnosticsScreen } from "@/components/meta-diagnostics-screen";
export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnóstico Meta | Atendimento", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function MetaDiagnostics() {
  try { await verifyAccessAdmin(env(), (await cookies()).get(ADMIN_COOKIE)?.value); }
  catch { redirect("/admin/meta/entrar"); }
  return <MetaDiagnosticsScreen />;
}
