import {NextRequest} from 'next/server';
import {env,json,failure,body,sameOrigin} from '@/lib/http';
import {CommerceError,availableMethods,requireReady} from '@/lib/commerce';
import {verifyAccessAdmin,ADMIN_COOKIE} from '@/lib/access-admin';
import {productBy,publicProduct,productPaymentEnv,requireDelivery} from '@/lib/platform-products';
import {captureSession,publicEvent} from '@/lib/platform-events';
import {createPlatformOrder,findPlatformOrder,orderCookie,chargePlatform,refreshPlatform,platformResult} from '@/lib/platform-payments';
import {limitedProductAction} from '@/lib/product-access';
import {hash} from '@/lib/commerce';
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string}>}){try{const runtime=env(),p=await productBy(runtime,(await params).slug,true);if(p.status==='draft'||p.status==='archived')await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);const result={product:publicProduct(p),available:false} as Record<string,unknown>;if(p.status==='active'){const configured=await productPaymentEnv(runtime,p);requireReady(configured);await requireDelivery(runtime,p);const methods=await availableMethods(configured);result.available=true;result.publicKey=configured.MERCADOPAGO_PUBLIC_KEY;result.paymentMethods={creditCard:methods.some(m=>m.payment_type_id==='credit_card'),pix:methods.some(m=>m.id==='pix')};}return json(result);}catch(e){return failure(e);}}
export async function POST(req:NextRequest,{params}:{params:Promise<{slug:string}>}){try{sameOrigin(req);const runtime=env(),p=await productBy(runtime,(await params).slug,true),input=await body(req);if(p.status==='draft'||p.status==='archived')await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);await limitedProductAction(runtime,'store:'+hash(req.headers.get('cf-connecting-ip')||'unknown'),50);
 if(input.action==='event'){if(p.status!=='active')return json({received:false});return json(await publicEvent(runtime,p,input,req));}
 if(input.action==='checkout'){const created=await createPlatformOrder(runtime,p,input,req,req.cookies.get(orderCookie(p.id))?.value),response=json({ready:true,orderId:created.order.id});response.cookies.set(orderCookie(p.id),created.access,{secure:true,httpOnly:true,sameSite:input.embedded===true?'none':'strict',partitioned:input.embedded===true,path:'/api',maxAge:30*86400});return response;}
 const o=await findPlatformOrder(runtime,p.id,req.cookies.get(orderCookie(p.id))?.value);
 if(input.action==='payment'){if(input.consent===false||req.headers.get('sec-gpc')==='1')await captureSession(runtime,p,{...input,consent:false},req);const result=await chargePlatform(runtime,o,input.formData);return json(platformResult(result.order,result.provider));}
 if(input.action==='status'){const result=await refreshPlatform(runtime,o);return json(platformResult(result.order,result.provider));}
 throw new CommerceError(400,'Ação inválida.');}catch(e){return failure(e);}}
