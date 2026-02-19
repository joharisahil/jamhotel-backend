/**
 * @model StockTransaction
 * @description Immutable ledger of all stock movements. This is the single source of truth
 *              for current stock levels. Current stock = SUM(IN + ADJUSTMENT_IN) - SUM(OUT + ADJUSTMENT_OUT).
 *              Records must NEVER be deleted or edited after creation.
 */

import mongoose from "mongoose";
import { TRANSACTION_TYPE, REFERENCE_TYPE } from "../constants/enums.js";

const stockTransactionSchema = new mongoose.Schema(
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
      required: true,
    },
    itemName: { type: String, required: true },
    itemSku: { type: String, required: true },

    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: Object.values(REFERENCE_TYPE),
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0.001, "Quantity must be positive"],
    },

    // Snapshot of stock level after this transaction
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, "Balance cannot be negative"],
    },

    // Reference links
    reference_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryBatch",
      default: null,
    },
    batchNumber: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    createdBy: {
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
stockTransactionSchema.index({ hotel_id: 1, item_id: 1, createdAt: -1 });
stockTransactionSchema.index({ hotel_id: 1, referenceType: 1, reference_id: 1 });
stockTransactionSchema.index({ hotel_id: 1, createdAt: -1 });

// ── Guard: prevent updates ───────────────────────────────────────
stockTransactionSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function () {
    throw new Error(
      "StockTransaction records are immutable and cannot be updated."
    );
  }
);

export default mongoose.model("StockTransaction", stockTransactionSchema);
