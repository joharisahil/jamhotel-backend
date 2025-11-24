// controllers/transactionController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import { createTransactionSchema } from "../validators/transactionValidator.js";
import * as transactionService from "../services/transactionService.js";

/** Create transaction */
export const createTransaction = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  // validate
  const data = createTransactionSchema.parse(req.body);

  const trx = await transactionService.createTransaction(hotel_id, data);

  res.json({ success: true, trx });
});

/** List transactions */
export const listTransactions = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const trx = await transactionService.listTransactions(hotel_id);

  res.json({ success: true, trx });
});
