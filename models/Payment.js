/**
 * @model Payment
 * @description Records individual payment transactions against a PurchaseInvoice.
 *              Partial payments are allowed; overpayments are blocked in paymentService.
 *              Each payment generates a corresponding JournalEntry.
 *              Payment records are immutable after creation.
 */

import mongoose from "mongoose";
import { PAYMENT_METHOD } from "../constants/enums.js";

const paymentSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseInvoice",
      required: [true, "Invoice reference is required"],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be positive"],
    },
    method: {
      type: String,
      enum: { values: Object.values(PAYMENT_METHOD), message: "Invalid payment method" },
      required: [true, "Payment method is required"],
    },
    reference: {
      type: String,
      trim: true,
      maxlength: [100, "Reference cannot exceed 100 characters"],
      default: "",
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },
    recordedBy: {
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
paymentSchema.index({ hotel_id: 1, invoice_id: 1, createdAt: -1 });
paymentSchema.index({ hotel_id: 1, vendor_id: 1, createdAt: -1 });
paymentSchema.index({ hotel_id: 1, paidAt: -1 });

// ── Guard: immutable records ─────────────────────────────────────
paymentSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function () {
    throw new Error(
      "Payment records are immutable and cannot be updated after creation."
    );
  }
);

export default mongoose.model("Payment", paymentSchema);
