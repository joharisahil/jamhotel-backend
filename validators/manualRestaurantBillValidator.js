import { z } from "zod";

export const manualRestaurantBillSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  tableNumber: z.string().optional(),

  items: z.array(z.object({
    name: z.string(),
    variant: z.string(),
    qty: z.number(),
    price: z.number(),
    total: z.number()
  })),

  subtotal: z.number(),
  discount: z.number(),
  gst: z.number(),
  finalAmount: z.number(),

  paymentMethod: z.enum(["cash", "upi", "card", "other"])
});
