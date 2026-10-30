import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {cloudflareEnv} from '@/lib/runtime';
import {productBy,publicProduct} from '@/lib/platform-products';
import {ADMIN_COOKIE,verifyAccessAdmin} from '@/lib/access-admin';
import {PlatformCheckout} from '@/components/platform-checkout';
export const dynamic='force-dynamic';
export const metadata={title:'Checkout seguro | JotaFy',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{embed?:string}>}){const runtime=cloudflareEnv()||{};let p;try{p=await productBy(runtime,(await params).slug,true);if(p.status==='draft'||p.status==='archived')await verifyAccessAdmin(runtime,(await cookies()).get(ADMIN_COOKIE)?.value);}catch{notFound();}return <PlatformCheckout product={publicProduct(p)} embedded={(await searchParams).embed==='1'}/>;}
