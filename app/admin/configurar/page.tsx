import { AccessAdminLogin } from '@/components/access-admin-screen';
export const metadata = { title: 'Configuração inicial | Gestão', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <AccessAdminLogin destination="/admin" />; }
