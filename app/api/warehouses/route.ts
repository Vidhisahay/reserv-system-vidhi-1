import { prisma } from "@/lib/prisma";
import { jsonError, jsonResponse } from "@/lib/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return jsonResponse(warehouses);
  } catch (error) {
    console.error("Failed to fetch warehouses", error);
    return jsonError("Failed to fetch warehouses");
  }
}
