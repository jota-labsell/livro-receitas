import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {cloudflareEnv} from '@/lib/runtime';
import {ADMIN_COOKIE,verifyAccessAdmin} from '@/lib/access-admin';
import {ManagementDashboard} from '@/components/management-dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Central de operação | Receitas Premium',robots:{index:false,follow:false}};
export default async function Page(){try{await verifyAccessAdmin(cloudflareEnv()||{},(await cookies()).get(ADMIN_COOKIE)?.value)}catch{redirect('/admin/entrar')}return <ManagementDashboard/>}
