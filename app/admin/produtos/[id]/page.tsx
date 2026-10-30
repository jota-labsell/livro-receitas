import {requirePlatformPage} from '@/lib/platform-admin';
import {PlatformProductEditor} from '@/components/platform-products';
import {cloudflareEnv} from '@/lib/runtime';
import {productBy,adminProduct} from '@/lib/platform-products';
export const dynamic='force-dynamic';
export const metadata={title:'Produto | JotaFy',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){await requirePlatformPage();const {id}=await params;return <PlatformProductEditor initial={id==='novo'?null:adminProduct(await productBy(cloudflareEnv()||{},id))}/>;}
