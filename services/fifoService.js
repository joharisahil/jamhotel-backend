/**
 * @service fifoService.js
 * @description FIFO batch deduction engine for perishable inventory.
 *
 * ALGORITHM:
 *  1. Fetch non-expired, non-fully-consumed batches for the item, sorted by expiryDate ASC
 *  2. Consume batches in order until required quantity is satisfied
 *  3. Update remainingQuantity on each consumed batch atomically
 *  4. Record a StockTransaction per batch consumed
 *  5. Throw if total available quantity across batches is insufficient
 *
 * All operations run inside a MongoDB session for atomicity.
 */

import InventoryBatch from "../models/InventoryBatch.js";
import StockTransaction from "../models/StockTransaction.js";
import { TRANSACTION_TYPE, REFERENCE_TYPE } from "../constants/enums.js";
import { MSG } from "../constants/messages.js";

/**
 * Deducts stock from perishable batches using FIFO (oldest expiry first).
 */
export async function deductFIFO({
  hotel_id,
  item_id,
  itemName,
  itemSku,
  requiredQty,
  referenceType,
  reference_id = null,
  notes = "",
  user,
  session,
}) {
  if (!session)
    throw new Error("fifoService.deductFIFO requires a Mongoose session.");

  const now = new Date();

  const batches = await InventoryBatch.find({
    hotel_id,
    item_id,
    isExpired: false,
    isFullyConsumed: false,
    expiryDate: { $gt: now },
    remainingQuantity: { $gt: 0 },
  })
    .sort({ expiryDate: 1 })
    .session(session);

  const totalAvailable = batches.reduce(
    (s, b) => s + b.remainingQuantity,
    0
  );

  if (totalAvailable < requiredQty) {
    throw new Error(
      MSG.INSUFFICIENT_STOCK(itemName, totalAvailable, requiredQty)
    );
  }

  const transactions = [];
  const batchesConsumed = [];
  let remaining = requiredQty;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const consume = Math.min(batch.remainingQuantity, remaining);
    remaining -= consume;

    const updatedRemaining = parseFloat(
      (batch.remainingQuantity - consume).toFixed(3)
    );

    await InventoryBatch.updateOne(
      { _id: batch._id },
      {
        $inc: { remainingQuantity: -consume },
        $set: {
          isFullyConsumed: updatedRemaining <= 0,
        },
      },
      { session }
    );

    const lastTxn = await StockTransaction.findOne({
      hotel_id,
      item_id,
    })
      .sort({ createdAt: -1 })
      .session(session);

    const currentBalance = lastTxn ? lastTxn.balanceAfter : 0;

    const balanceAfter = parseFloat(
      (currentBalance - consume).toFixed(3)
    );

    const [txn] = await StockTransaction.create(
      [
        {
          hotel_id,
          item_id,
          itemName,
          itemSku,
          type: TRANSACTION_TYPE.OUT,
          referenceType,
          quantity: consume,
          balanceAfter: Math.max(0, balanceAfter),
          reference_id,
          batch_id: batch._id,
          batchNumber: batch.batchNumber,
          notes:
            notes || `FIFO deduction from batch ${batch.batchNumber}`,
          createdBy: user._id,
        },
      ],
      { session }
    );

    transactions.push(txn);

    batchesConsumed.push({
      batch_id: batch._id,
      batchNumber: batch.batchNumber,
      quantityConsumed: consume,
    });
  }

  return {
    transactions,
    batchesConsumed,
    totalDeducted: parseFloat(
      (requiredQty - remaining).toFixed(3)
    ),
  };
}

/**
 * Marks expired batches.
 */
export async function markExpiredBatches(hotel_id = null) {
  const filter = {
    expiryDate: { $lte: new Date() },
    isExpired: false,
    isFullyConsumed: false,
  };

  if (hotel_id) filter.hotel_id = hotel_id;

  const result = await InventoryBatch.updateMany(
    filter,
    { $set: { isExpired: true } }
  );

  return result.modifiedCount;
}

/**
 * Returns batches expiring within N days.
 */
export async function getExpiringBatches(hotel_id, days = 30) {
  const now = new Date();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);

  return InventoryBatch.find({
    hotel_id,
    isExpired: false,
    isFullyConsumed: false,
    remainingQuantity: { $gt: 0 },
    expiryDate: { $gte: now, $lte: deadline },
  })
    .sort({ expiryDate: 1 })
    .populate("item_id", "name sku unit")
    .populate("invoice_id", "invoiceNumber");
}
