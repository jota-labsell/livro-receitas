import { NextRequest } from "next/server";
import { env, ORDER_COOKIE } from "@/lib/http";
import { deliverProduct } from "@/lib/product-delivery";
import { PRODUCT_ACCESS_COOKIE } from "@/lib/product-access";
import { getEbook, getEbookBody } from "@/lib/ebook";
export async function GET(req: NextRequest) {
  return deliverProduct(env(), req.url, req.cookies.get(ORDER_COOKIE)?.value,
    req.cookies.get(PRODUCT_ACCESS_COOKIE)?.value, { manifest: getEbook, body: getEbookBody });
}
