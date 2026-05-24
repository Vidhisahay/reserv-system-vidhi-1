import { prisma } from "@/lib/prisma";

export async function expirePendingReservations(now = new Date()) {
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: {
        lt: now,
      },
    },
  });

  let count = 0;

  for (const reservation of expiredReservations) {
    const released = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: "PENDING",
          expiresAt: {
            lt: now,
          },
        },
        data: {
          status: "RELEASED",
        },
      });

      if (updateResult.count === 0) {
        return false;
      }

      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reserved: {
            decrement: reservation.quantity,
          },
        },
      });

      return true;
    });

    if (released) {
      count += 1;
    }
  }

  return count;
}
