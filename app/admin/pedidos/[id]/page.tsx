import {requirePlatformPage} from '@/lib/platform-admin';
import {PlatformOrderDetail} from '@/components/platform-order';
export const dynamic='force-dynamic';
export const metadata={title:'Pedido | JotaFy',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){await requirePlatformPage();return <PlatformOrderDetail id={(await params).id}/>;}
