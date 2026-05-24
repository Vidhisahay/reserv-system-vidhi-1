import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const ReservationIdSchema = z.object({
  id: z.string().min(1),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
