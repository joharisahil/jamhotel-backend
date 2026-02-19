/**
 * @model InventoryBatch
 * @description Tracks individual batches of perishable inventory received via purchase invoices.
 *              The FIFO deduction engine reads this collection sorted by expiryDate ASC.
 *              remainingQuantity is decremented atomically during deduction — never set manually.
 */

import mongoose from "mongoose";

const inventoryBatchSchema = new mongoose.Schema(
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

    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseInvoice",
      required: [true, "Invoice reference is required"],
    },

    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
      uppercase: true,
    },

    manufacturingDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required for perishable batches"],
      index: true,
    },

    receivedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    receivedQuantity: {
      type: Number,
      required: true,
      min: [0.001, "Received quantity must be positive"],
    },

    remainingQuantity: {
      type: Number,
      required: true,
      min: [0, "Remaining quantity cannot be negative"],
    },

    unitCost: {
      type: Number,
      required: true,
      min: [0, "Unit cost cannot be negative"],
    },

    isExpired: {
      type: Boolean,
      default: false,
      index: true,
    },

    isFullyConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ─────────────────────────────────────────────

// FIFO query
inventoryBatchSchema.index({
  hotel_id: 1,
  item_id: 1,
  expiryDate: 1,
  isExpired: 1,
  isFullyConsumed: 1,
});

// Invoice → batch lookup
inventoryBatchSchema.index({ hotel_id: 1, invoice_id: 1 });

// Expiry dashboard
inventoryBatchSchema.index({
  hotel_id: 1,
  expiryDate: 1,
  isExpired: 1,
  isFullyConsumed: 1,
});

// ── Virtual: days until expiry ───────────────────────────

inventoryBatchSchema.virtual("daysUntilExpiry").get(function () {
  const now = new Date();
  return Math.ceil((this.expiryDate - now) / (1000 * 60 * 60 * 24));
});

export default mongoose.model("InventoryBatch", inventoryBatchSchema);
