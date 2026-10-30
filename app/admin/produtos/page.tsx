import {requirePlatformPage} from '@/lib/platform-admin';
import {PlatformProducts} from '@/components/platform-products';
export const dynamic='force-dynamic';
export const metadata={title:'Produtos | JotaFy',robots:{index:false,follow:false}};
export default async function Page(){await requirePlatformPage();return <PlatformProducts/>;}
