import {NextRequest} from 'next/server';
import {env} from '@/lib/http';
import {productBy} from '@/lib/platform-products';
import {orderCookie} from '@/lib/platform-payments';
import {PLATFORM_ACCESS_COOKIE,resolvePlatformAccess,deliverPlatformFile} from '@/lib/platform-delivery';
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string}>}){const slug=(await params).slug;try{const runtime=env(),p=await productBy(runtime,slug,true);const o=await resolvePlatformAccess(runtime,p.id,req.cookies.get(orderCookie(p.id))?.value,req.cookies.get(PLATFORM_ACCESS_COOKIE)?.value);return await deliverPlatformFile(runtime,o);}catch{const target=new URL('/entrega/'+encodeURIComponent(slug),req.url);target.searchParams.set('estado','verificar');return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});}}
