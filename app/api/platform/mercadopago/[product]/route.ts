import {NextRequest} from 'next/server';
import {env,json,failure} from '@/lib/http';
import {receivePlatformProductWebhook} from '@/lib/platform-payments';
export async function POST(req:NextRequest,{params}:{params:Promise<{product:string}>}){try{return json(await receivePlatformProductWebhook(env(),(await params).product,req));}catch(e){return failure(e);}}
