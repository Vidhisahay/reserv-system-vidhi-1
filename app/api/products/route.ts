import { expirePendingReservations } from "@/lib/expire-reservations";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonResponse } from "@/lib/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await expirePendingReservations();

    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: {
            warehouse: true,
          },
          orderBy: {
            warehouse: {
              name: "asc",
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const productsWithAvailability = products.map((product) => ({
      ...product,
      stock: product.stock.map((stock) => ({
        ...stock,
        available: Math.max(stock.total - stock.reserved, 0),
      })),
    }));

    return jsonResponse(productsWithAvailability);
  } catch (error) {
    console.error("Failed to fetch products", error);
    return jsonError("Failed to fetch products");
  }
}
