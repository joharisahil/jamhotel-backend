import { z } from "zod";

export const createRoomSchema = z.object({
  number: z.string(),
  type: z.string().optional(),
  floor: z.number().optional(),
  baseRate: z.number().optional(),
  maxGuests: z.number().min(1).optional(),
  plans: z.array(z.object({ code: z.string(), name: z.string(), rate: z.number() })).optional()
});
