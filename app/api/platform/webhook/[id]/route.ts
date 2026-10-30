import {NextRequest} from 'next/server';
import {env,json,failure} from '@/lib/http';
import {platformWebhook} from '@/lib/platform-payments';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{return json(await platformWebhook(env(),(await params).id,req));}catch(e){return failure(e);}}
