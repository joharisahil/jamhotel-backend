/**
 * @model StockAdjustment
 * @description Records manual stock corrections with reason codes.
 *              Each adjustment MUST generate a corresponding StockTransaction.
 *              Used for damaged goods, expiry write-offs, theft, corrections, and opening stock.
 */

import mongoose from "mongoose";
import { ADJUSTMENT_REASON } from "../constants/enums.js";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: [true, "Item reference is required"],
    },
    itemName: { type: String, required: true },
    itemSku: { type: String, required: true },

    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: [true, "Adjustment type (IN/OUT) is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.001, "Quantity must be positive"],
    },
    reason: {
      type: String,
      enum: {
        values: Object.values(ADJUSTMENT_REASON),
        message: "Invalid reason code",
      },
      required: [true, "Reason code is required"],
    },
    notes: {
      type: String,
      required: [true, "Notes are mandatory for audit trail"],
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },

    // Snapshot values at time of adjustment
    balanceBefore: { type: Number, required: true },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, "Balance after cannot be negative"],
    },

    // Link to generated StockTransaction
    stockTransaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockTransaction",
    },

    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ─────────────────────────────────────────────────────
stockAdjustmentSchema.index({ hotel_id: 1, item_id: 1, createdAt: -1 });
stockAdjustmentSchema.index({ hotel_id: 1, reason: 1 });
stockAdjustmentSchema.index({ hotel_id: 1, createdAt: -1 });

export default mongoose.model("StockAdjustment", stockAdjustmentSchema);
