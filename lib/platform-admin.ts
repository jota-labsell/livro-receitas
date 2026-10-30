import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import type {NextRequest} from 'next/server';
import {ADMIN_COOKIE,verifyAccessAdmin} from './access-admin';
import {env,sameOrigin} from './http';
import {cloudflareEnv} from './runtime';
import {limitedProductAction} from './product-access';
export async function requirePlatformPage(){try{await verifyAccessAdmin(cloudflareEnv()||{},(await cookies()).get(ADMIN_COOKIE)?.value);}catch{redirect('/admin/entrar');}}
export async function platformAdmin(req:NextRequest,mutation=false){if(mutation)sameOrigin(req);const runtime=env(),actor=await verifyAccessAdmin(runtime,req.cookies.get(ADMIN_COOKIE)?.value);if(mutation)await limitedProductAction(runtime,'platform-admin:'+actor,30);return {runtime,actor};}
