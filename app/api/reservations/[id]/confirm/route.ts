import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { jsonError, jsonResponse } from "@/lib/route-utils";
import { ReservationIdSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = ReservationIdSchema.parse(params);
    const idempotencyKey = request.headers.get("Idempotency-Key");
    const cacheKey = idempotencyKey ? `idempotency:${idempotencyKey}` : null;

    if (cacheKey) {
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        return jsonResponse(cachedResponse, { status: 200 });
      }
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return jsonError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    if (reservation.status === "CONFIRMED") {
      if (cacheKey) {
        await redis.set(cacheKey, reservation, {
          ex: IDEMPOTENCY_TTL_SECONDS,
        });
      }

      return jsonResponse(reservation, { status: 200 });
    }

    if (reservation.expiresAt < new Date() || reservation.status === "RELEASED") {
      return jsonError(
        "Reservation has expired or been released",
        410,
        "RESERVATION_EXPIRED_OR_RELEASED",
      );
    }

    const updatedReservation = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.reservation.updateMany({
        where: {
          id,
          status: "PENDING",
        },
        data: {
          status: "CONFIRMED",
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
          total: {
            decrement: reservation.quantity,
          },
        },
      });

      return tx.reservation.findUniqueOrThrow({
        where: { id },
      });
    });

    if (updatedReservation.status !== "CONFIRMED") {
      return jsonError(
        "Reservation has expired or been released",
        410,
        "RESERVATION_EXPIRED_OR_RELEASED",
      );
    }

    if (cacheKey) {
      await redis.set(cacheKey, updatedReservation, {
        ex: IDEMPOTENCY_TTL_SECONDS,
      });
    }

    return jsonResponse(updatedReservation, { status: 200 });
  } catch (error) {
    console.error("Failed to confirm reservation", error);
    return jsonError("Failed to confirm reservation");
  }
}
