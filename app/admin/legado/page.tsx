import {requirePlatformPage} from '@/lib/platform-admin';
import {ManagementDashboard} from '@/components/management-dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Operação legada | JotaFy',robots:{index:false,follow:false}};
export default async function Page(){await requirePlatformPage();return <ManagementDashboard/>;}
