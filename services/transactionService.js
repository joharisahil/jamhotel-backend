// services/transactionService.js
import Transaction from "../models/Transaction.js";

/**
 * Create transaction entry
 * payload:
 * {
 *   type: "CREDIT" | "DEBIT",
 *   source: "ROOM" | "RESTAURANT" | "BANQUET" | "MAINTENANCE" | "OTHER",
 *   amount,
 *   description,
 *   referenceId (order/booking id)
 * }
 */
export const createTransaction = async (hotel_id, payload) => {
  const trx = await Transaction.create({
    hotel_id,
    ...payload,
  });
  return trx;
};

/**
 * List all transactions for the hotel
 */
export const listTransactions = async (hotel_id, filters = {}) => {
  return Transaction.find({ hotel_id, ...filters }).sort({ createdAt: -1 });
};
