import {requirePlatformPage} from '@/lib/platform-admin';
import {PlatformDashboard} from '@/components/platform-dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'JotaFy | Operação',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{secao?:string}>}){await requirePlatformPage();return <PlatformDashboard section={(await searchParams).secao||'summary'}/>;}
