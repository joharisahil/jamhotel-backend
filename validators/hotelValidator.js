import { z } from "zod";

export const createHotelSchema = z.object({
  name: z.string().min(2, "Hotel name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid hotel email").optional(),
  gstNumber: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  gst_enabled: z.boolean().optional()
});

export const updateHotelSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  gstNumber: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  gst_enabled: z.boolean().optional()
});
