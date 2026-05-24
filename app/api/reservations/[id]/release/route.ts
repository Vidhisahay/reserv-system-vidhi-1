import { prisma } from "@/lib/prisma";
import { jsonError, jsonResponse } from "@/lib/route-utils";
import { ReservationIdSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = ReservationIdSchema.parse(params);

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return jsonError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status === "RELEASED") {
      return jsonResponse(reservation, { status: 200 });
    }

    if (reservation.status === "CONFIRMED") {
      return jsonError(
        "Cannot release a confirmed reservation",
        400,
        "CONFIRMED_RESERVATION",
      );
    }

    const updatedReservation = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.reservation.updateMany({
        where: {
          id,
          status: "PENDING",
        },
        data: {
          status: "RELEASED",
        },
      });

      if (updateResult.count === 0) {
        return tx.reservation.findUniqueOrThrow({
          where: { id },
        });
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

      return tx.reservation.findUniqueOrThrow({
        where: { id },
      });
    });

    return jsonResponse(updatedReservation, { status: 200 });
  } catch (error) {
    console.error("Failed to release reservation", error);
    return jsonError("Failed to release reservation");
  }
}
