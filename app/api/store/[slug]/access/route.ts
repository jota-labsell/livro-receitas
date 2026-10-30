import {NextRequest} from 'next/server';
import {env,json,failure,body,sameOrigin} from '@/lib/http';
import {CommerceError,hash} from '@/lib/commerce';
import {productBy} from '@/lib/platform-products';
import {orderCookie,platformResult} from '@/lib/platform-payments';
import {PLATFORM_ACCESS_COOKIE,resolvePlatformAccess,redeemPlatformAccess} from '@/lib/platform-delivery';
import {limitedProductAction} from '@/lib/product-access';
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string}>}){try{const runtime=env(),p=await productBy(runtime,(await params).slug,true),o=await resolvePlatformAccess(runtime,p.id,req.cookies.get(orderCookie(p.id))?.value,req.cookies.get(PLATFORM_ACCESS_COOKIE)?.value);return json(platformResult(o));}catch(e){return failure(e);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{slug:string}>}){try{sameOrigin(req);const runtime=env(),p=await productBy(runtime,(await params).slug,true);await limitedProductAction(runtime,'redeem:'+hash(req.headers.get('cf-connecting-ip')||'unknown'),10);const input=await body(req),result=await redeemPlatformAccess(runtime,input.token);if(result.order.product_id!==p.id)throw new CommerceError(403,'Este link pertence a outro produto.');const response=json(platformResult(result.order));response.cookies.set(PLATFORM_ACCESS_COOKIE,result.session,{secure:true,httpOnly:true,sameSite:'strict',path:'/',maxAge:Math.max(1,Math.floor((result.expiresAt-Date.now())/1000))});return response;}catch(e){return failure(e);}}
