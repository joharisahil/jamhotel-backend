// validators/transactionValidator.js
import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"], {
    required_error: "Transaction type is required",
  }),
  
  source: z.enum(
    [
      "ROOM",
      "RESTAURANT",
      "BANQUET",
      "MAINTENANCE",
      "LAUNDRY",
      "INVENTORY",
      "OTHER",
    ],
    { required_error: "Transaction source is required" }
  ),

  amount: z.number().positive("Amount must be positive"),

  description: z.string().optional(),

  referenceId: z.string().optional(),
});
