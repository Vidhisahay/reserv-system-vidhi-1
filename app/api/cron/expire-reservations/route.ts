import { expirePendingReservations } from "@/lib/expire-reservations";
import { jsonError, jsonResponse } from "@/lib/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const count = await expirePendingReservations();

    return jsonResponse({ count }, { status: 200 });
  } catch (error) {
    console.error("Failed to expire reservations", error);
    return jsonError("Failed to expire reservations");
  }
}
