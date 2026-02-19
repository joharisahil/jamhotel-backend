/**
 * @model PurchaseInvoice
 * @description Core procurement document. Follows a strict state machine:
 *              DRAFT → APPROVED → POSTED → CANCELLED
 *              Once POSTED, the document is immutable (enforced in service layer).
 *              All financial totals are recalculated on the backend — never trusted from client.
 */

import mongoose from "mongoose";
import {
  INVOICE_STATE,
  PAYMENT_STATUS,
  TAX_TYPE,
} from "../constants/enums.js";

// ── Line Item Sub-document ───────────────────────────────────────
const lineItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: [true, "Item reference is required"],
    },
    itemName: { type: String, required: true, trim: true },
    itemSku: { type: String, required: true, trim: true },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, "Quantity must be greater than zero"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
    },
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    taxType: {
      type: String,
      enum: Object.values(TAX_TYPE),
      default: TAX_TYPE.NONE,
    },
    // Calculated server-side
    subtotal: { type: Number, required: true },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    // Perishable batch fields (required if item.isPerishable)
    batchNumber: { type: String, trim: true, uppercase: true, default: "" },
    expiryDate: { type: Date, default: null },
    isPerishable: { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Tax Breakdown Sub-document ───────────────────────────────────
const taxBreakdownSchema = new mongoose.Schema(
  {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── State Log Sub-document ───────────────────────────────────────
const stateLogSchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// ── Main Schema ──────────────────────────────────────────────────
const purchaseInvoiceSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
    },
    vendorName: { type: String, required: true, trim: true },
    items: {
      type: [lineItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Invoice must have at least one line item",
      },
    },
    // All totals calculated server-side
    subtotal: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    taxBreakdown: { type: taxBreakdownSchema, default: () => ({}) },
    grandTotal: { type: Number, required: true, min: 0 },

    // State machine
    invoiceState: {
      type: String,
      enum: Object.values(INVOICE_STATE),
      default: INVOICE_STATE.DRAFT,
      index: true,
    },
    stateLog: [stateLogSchema],

    // Payment tracking (derived, but cached for performance)
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    paidAmount: { type: Number, default: 0, min: 0 },
    outstandingAmount: { type: Number, default: 0, min: 0 },

    // Journal reference (set after posting)
    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },

    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    cancellationReason: { type: String, trim: true, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    postedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────────────
purchaseInvoiceSchema.index(
  { hotel_id: 1, invoiceNumber: 1 },
  { unique: true }
);
purchaseInvoiceSchema.index({ hotel_id: 1, vendor_id: 1, invoiceState: 1 });
purchaseInvoiceSchema.index({ hotel_id: 1, createdAt: -1 });
purchaseInvoiceSchema.index({
  hotel_id: 1,
  paymentStatus: 1,
  invoiceState: 1,
});

export default mongoose.model("PurchaseInvoice", purchaseInvoiceSchema);
