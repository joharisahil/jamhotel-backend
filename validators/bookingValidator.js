import { z } from "zod";

export const createBookingSchema = z.object({
  room_id: z.string(),
  guestName: z.string(),
  guestPhone: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  planCode: z.string().optional(),
  advancePaid: z.number().optional()
});
