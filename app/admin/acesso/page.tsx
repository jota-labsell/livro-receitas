import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { env } from "@/lib/http";
import { AccessAdminScreen } from "@/components/access-admin-screen";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recuperar acesso | Atendimento", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function AdminAccess() {
  try { await verifyAccessAdmin(env(), (await cookies()).get(ADMIN_COOKIE)?.value); }
  catch { redirect("/admin/acesso/entrar"); }
  return <AccessAdminScreen />;
}
