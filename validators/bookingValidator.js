import { z } from "zod";

export const createBookingSchema = z.object({
  room_id: z.string(),
  guestName: z.string(),
  guestPhone: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  planCode: z.string(),
  adults: z.number(),
  children: z.number(),
  advancePaid: z.number().default(0),
  discount: z.number().default(0),
  addedServices: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
    })
  ).default([]),
});
