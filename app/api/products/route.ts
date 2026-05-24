import { getProductsWithStock } from "@/lib/products";
import { jsonError, jsonResponse } from "@/lib/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getProductsWithStock();

    return jsonResponse(products);
  } catch (error) {
    console.error("Failed to fetch products", error);
    return jsonError("Failed to fetch products");
  }
}
