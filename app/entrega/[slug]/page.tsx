import {cookies} from 'next/headers';
import {ADMIN_COOKIE,verifyAccessAdmin} from '@/lib/access-admin';
import {notFound} from 'next/navigation';
import {cloudflareEnv} from '@/lib/runtime';
import {productBy,publicProduct} from '@/lib/platform-products';
import {PlatformCheckout} from '@/components/platform-checkout';
export const dynamic='force-dynamic';
export const metadata={title:'Seu produto | JotaFy',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params}:{params:Promise<{slug:string}>}){let p;try{const runtime=cloudflareEnv()||{};p=await productBy(runtime,(await params).slug,true);if(p.status==='draft')await verifyAccessAdmin(runtime,(await cookies()).get(ADMIN_COOKIE)?.value);}catch{notFound();}return <PlatformCheckout product={publicProduct(p)} accessOnly/>;}
