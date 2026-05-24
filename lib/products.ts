import { expirePendingReservations } from "@/lib/expire-reservations";
import { prisma } from "@/lib/prisma";
import type { ProductWithStock } from "@/types";

export async function getProductsWithStock(): Promise<ProductWithStock[]> {
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

  return products.map((product) => ({
    ...product,
    createdAt: product.createdAt.toISOString(),
    stock: product.stock.map((stock) => ({
      ...stock,
      available: Math.max(stock.total - stock.reserved, 0),
      warehouse: {
        ...stock.warehouse,
        createdAt: stock.warehouse.createdAt.toISOString(),
      },
    })),
  }));
}
