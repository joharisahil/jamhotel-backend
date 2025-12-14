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
  advancePaymentMode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"]).optional(),
  discount: z.number().default(0),
  guestIds: z.array(z.object({
  type: z.enum(["Aadhaar Card", "Driving License", "Passport", "Voter ID"]),
  idNumber: z.string().min(3),
  nameOnId: z.string().min(2)
})).optional(),

  addedServices: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
    })
  ).default([]),
});
