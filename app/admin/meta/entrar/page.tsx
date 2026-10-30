import { AccessAdminLogin } from "@/components/access-admin-screen";
export const metadata = { title: "API da Meta | Entrar", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function MetaLogin() { return <AccessAdminLogin destination="/admin/meta" />; }
