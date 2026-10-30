import {requirePlatformPage} from '@/lib/platform-admin';
import {PlatformIntegrations} from '@/components/platform-integrations';
export const dynamic='force-dynamic';
export const metadata={title:'Meta Ads | JotaFy',robots:{index:false,follow:false}};
export default async function Page(){await requirePlatformPage();return <PlatformIntegrations/>;}
