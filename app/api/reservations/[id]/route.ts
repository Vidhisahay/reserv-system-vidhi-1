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

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const parsedParams = ReservationIdSchema.parse(params);

    const reservation = await prisma.reservation.findUnique({
      where: {
        id: parsedParams.id,
      },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!reservation) {
      return jsonError("Reservation not found", 404, "RESERVATION_NOT_FOUND");
    }

    return jsonResponse(reservation);
  } catch (error) {
    console.error("Failed to fetch reservation", error);
    return jsonError("Failed to fetch reservation");
  }
}
