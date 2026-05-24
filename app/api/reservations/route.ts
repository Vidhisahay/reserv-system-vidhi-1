import { addMinutes } from "date-fns";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { acquireLock, releaseLock } from "@/lib/lock";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { jsonError, jsonResponse } from "@/lib/route-utils";
import {
  CreateReservationSchema,
  type CreateReservationInput,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24;

export async function POST(request: NextRequest) {
  let parsedBody: CreateReservationInput;

  try {
    const body = await request.json();
    parsedBody = CreateReservationSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid reservation request", 400, "VALIDATION_ERROR");
    }

    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");
  const cacheKey = idempotencyKey ? `idempotency:${idempotencyKey}` : null;

  try {
    if (cacheKey) {
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        return jsonResponse(cachedResponse, { status: 200 });
      }
    }

    const lockKey = `stock:${parsedBody.productId}:${parsedBody.warehouseId}`;
    const lockId = await acquireLock(lockKey);

    if (!lockId) {
      return jsonError("Resource is locked, please retry", 409, "RESOURCE_LOCKED");
    }

    try {
      const stock = await prisma.stock.findUnique({
        where: {
          productId_warehouseId: {
            productId: parsedBody.productId,
            warehouseId: parsedBody.warehouseId,
          },
        },
      });

      if (!stock) {
        return jsonError("Stock record not found", 404, "STOCK_NOT_FOUND");
      }

      const available = stock.total - stock.reserved;

      if (available < parsedBody.quantity) {
        return jsonError(
          "Not enough stock available",
          409,
          "INSUFFICIENT_STOCK",
        );
      }

      const reservation = await prisma.$transaction(async (tx) => {
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: parsedBody.productId,
              warehouseId: parsedBody.warehouseId,
            },
          },
          data: {
            reserved: {
              increment: parsedBody.quantity,
            },
          },
        });

        return tx.reservation.create({
          data: {
            productId: parsedBody.productId,
            warehouseId: parsedBody.warehouseId,
            quantity: parsedBody.quantity,
            status: "PENDING",
            expiresAt: addMinutes(new Date(), 10),
            idempotencyKey,
          },
        });
      });

      if (cacheKey) {
        await redis.set(cacheKey, reservation, {
          ex: IDEMPOTENCY_TTL_SECONDS,
        });
      }

      return jsonResponse(reservation, { status: 201 });
    } finally {
      await releaseLock(lockKey, lockId);
    }
  } catch (error) {
    console.error("Failed to create reservation", error);
    return jsonError("Failed to create reservation");
  }
}
