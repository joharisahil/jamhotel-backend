/**
 * @service stockService.js
 * @description Manages all stock movement operations.
 *
 * RULES:
 *  1. Stock CANNOT be edited directly on InventoryItem — only via StockTransaction
 *  2. Every stock movement creates an immutable StockTransaction
 *  3. Negative stock is strictly prevented
 *  4. Current stock is derived by aggregating StockTransactions
 *  5. All writes happen inside a MongoDB session
 */import mongoose from "mongoose";
import StockTransaction from "../models/StockTransaction.js";
import InventoryItem from "../models/InventoryItem.js";
import { TRANSACTION_TYPE } from "../constants/enums.js";
import { MSG } from "../constants/messages.js";

/* ── Get Current Stock ─────────────────────────────────────────── */
export async function getCurrentStock(
  hotel_id,
  item_id,
  session = null
) {
  const agg = await StockTransaction.aggregate([
    {
      $match: {
        hotel_id: new mongoose.Types.ObjectId(hotel_id),
        item_id: new mongoose.Types.ObjectId(item_id),
      },
    },
    {
      $group: {
        _id: null,
        totalIn: {
          $sum: {
            $cond: [
              { $eq: ["$type", TRANSACTION_TYPE.IN] },
              "$quantity",
              0,
            ],
          },
        },
        totalOut: {
          $sum: {
            $cond: [
              { $eq: ["$type", TRANSACTION_TYPE.OUT] },
              "$quantity",
              0,
            ],
          },
        },
        totalAdjIn: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: [
                      "$type",
                      TRANSACTION_TYPE.ADJUSTMENT,
                    ],
                  },
                  { $gt: ["$quantity", 0] },
                ],
              },
              "$quantity",
              0,
            ],
          },
        },
        totalAdjOut: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: [
                      "$type",
                      TRANSACTION_TYPE.ADJUSTMENT,
                    ],
                  },
                  { $lt: ["$quantity", 0] },
                ],
              },
              { $abs: "$quantity" },
              0,
            ],
          },
        },
      },
    },
  ]);

  if (!agg.length) return 0;

  const {
    totalIn,
    totalOut,
    totalAdjIn,
    totalAdjOut,
  } = agg[0];

  return parseFloat(
    (
      totalIn +
      totalAdjIn -
      (totalOut + totalAdjOut)
    ).toFixed(3)
  );
}

/* ── Stock IN ───────────────────────────────────────────────────── */
export async function stockIn({
  hotel_id,
  item_id,
  quantity,
  referenceType,
  reference_id = null,
  batch_id = null,
  batchNumber = "",
  notes = "",
  user,
  session,
}) {
  const item = await InventoryItem.findOne({
    _id: item_id,
    hotel_id,
  }).session(session);

  if (!item)
    throw new Error(
      MSG.NOT_FOUND("Inventory item")
    );

  const currentStock =
    await getCurrentStock(
      hotel_id,
      item_id,
      session
    );

  const balanceAfter = parseFloat(
    (currentStock + quantity).toFixed(3)
  );

  const [txn] = await StockTransaction.create(
    [
      {
        hotel_id,
        item_id,
        itemName: item.name,
        itemSku: item.sku,
        type: TRANSACTION_TYPE.IN,
        referenceType,
        quantity,
        balanceAfter,
        reference_id,
        batch_id,
        batchNumber,
        notes,
        createdBy: user._id,
      },
    ],
    { session }
  );

  return txn;
}

/* ── Stock OUT ─────────────────────────────────────────────────── */
export async function stockOut({
  hotel_id,
  item_id,
  quantity,
  referenceType,
  reference_id = null,
  batch_id = null,
  batchNumber = "",
  notes = "",
  user,
  session,
}) {
  const item = await InventoryItem.findOne({
    _id: item_id,
    hotel_id,
  }).session(session);

  if (!item)
    throw new Error(
      MSG.NOT_FOUND("Inventory item")
    );

  const currentStock =
    await getCurrentStock(
      hotel_id,
      item_id,
      session
    );

  if (quantity > currentStock) {
    throw new Error(
      MSG.INSUFFICIENT_STOCK(
        item.name,
        currentStock,
        quantity
      )
    );
  }

  const balanceAfter = parseFloat(
    (currentStock - quantity).toFixed(3)
  );

  const [txn] = await StockTransaction.create(
    [
      {
        hotel_id,
        item_id,
        itemName: item.name,
        itemSku: item.sku,
        type: TRANSACTION_TYPE.OUT,
        referenceType,
        quantity,
        balanceAfter,
        reference_id,
        batch_id,
        batchNumber,
        notes,
        createdBy: user._id,
      },
    ],
    { session }
  );

  return txn;
}

/* ── Stock Adjustment ──────────────────────────────────────────── */
export async function stockAdjust({
  hotel_id,
  item_id,
  adjustmentType,
  quantity,
  referenceType,
  reference_id = null,
  notes = "",
  user,
  session,
}) {
  const item = await InventoryItem.findOne({
    _id: item_id,
    hotel_id,
  }).session(session);

  if (!item)
    throw new Error(
      MSG.NOT_FOUND("Inventory item")
    );

  const currentStock =
    await getCurrentStock(
      hotel_id,
      item_id,
      session
    );

  const balanceBefore = currentStock;

  if (
    adjustmentType === "OUT" &&
    quantity > currentStock
  ) {
    throw new Error(
      MSG.INSUFFICIENT_STOCK(
        item.name,
        currentStock,
        quantity
      )
    );
  }

  const signedQty =
    adjustmentType === "IN"
      ? quantity
      : -quantity;

  const balanceAfter = parseFloat(
    (currentStock + signedQty).toFixed(3)
  );

  const [txn] = await StockTransaction.create(
    [
      {
        hotel_id,
        item_id,
        itemName: item.name,
        itemSku: item.sku,
        type: TRANSACTION_TYPE.ADJUSTMENT,
        referenceType,
        quantity: signedQty,
        balanceAfter,
        reference_id,
        notes,
        createdBy: user._id,
      },
    ],
    { session }
  );

  return {
    transaction: txn,
    balanceBefore,
    balanceAfter,
  };
}

/* ── Transaction History ───────────────────────────────────────── */
export async function getTransactionHistory({
  hotel_id,
  item_id,
  page = 1,
  limit = 50,
}) {
  const filter = { hotel_id, item_id };
  const skip = (page - 1) * limit;

  const total =
    await StockTransaction.countDocuments(
      filter
    );

  const txns =
    await StockTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "name role");

  return {
    transactions: txns,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}
