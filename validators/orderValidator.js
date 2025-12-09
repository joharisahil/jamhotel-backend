import { z } from "zod";

export const createOrderSchema = z.object({
  hotel_id: z.string(),
  source: z.enum(["QR","TABLE","ROOM"]),
  table_id: z.string().optional(),
  room_id: z.string().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  sessionToken: z.string(),
  items: z.array(z.object({ item_id: z.string(), size: z.enum(["SINGLE", "HALF", "FULL"]), qty: z.number().min(1) }))
});
