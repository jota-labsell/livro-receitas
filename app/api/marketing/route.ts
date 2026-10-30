import { marketingConfig } from "@/lib/marketing-config";
import { cloudflareEnv } from "@/lib/runtime";
import { json } from "@/lib/http";

export async function GET() {
  return json(await marketingConfig(cloudflareEnv()));
}
