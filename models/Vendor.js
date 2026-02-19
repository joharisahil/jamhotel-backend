/**
 * @model Vendor
 * @description Supplier master record. Includes GST compliance fields,
 *              payment terms, bank details, and opening balance for ledger setup.
 *              Vendor outstanding is ALWAYS derived from PurchaseInvoice + Payment,
 *              never stored directly.
 */

import mongoose from "mongoose";
import { PAYMENT_TERMS } from "../constants/enums.js";

const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, maxlength: 100 },
    accountNumber: { type: String, trim: true, maxlength: 20 },
    ifscCode: { type: String, trim: true, uppercase: true, maxlength: 11 },
    accountHolder: { type: String, trim: true, maxlength: 100 },
    branchName: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: [true, "hotel_id is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [100, "Contact person name cannot exceed 100 characters"],
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [15, "Phone number cannot exceed 15 characters"],
      default: "",
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
      default: "",
    },

    // ── GST Compliance ────────────────────────────────────────────
    gstRegistered: {
      type: Boolean,
      default: false,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN cannot exceed 15 characters"],
      default: "",
      match: [
        /^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GSTIN format",
      ],
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, "PAN cannot exceed 10 characters"],
      default: "",
      match: [/^$|^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"],
    },

    // ── Payment Terms ─────────────────────────────────────────────
    paymentTerms: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_TERMS),
        message: "Invalid payment terms",
      },
      default: PAYMENT_TERMS.NET_30,
    },
    creditDays: {
      type: Number,
      default: 30,
      min: [0, "Credit days cannot be negative"],
      max: [365, "Credit days cannot exceed 365"],
    },

    // ── Opening Balance ────────────────────────────────────────────
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Opening balance cannot be negative"],
    },

    // ── Bank Details ──────────────────────────────────────────────
    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────────────
vendorSchema.index({ hotel_id: 1, name: 1 }, { unique: true });
vendorSchema.index({ hotel_id: 1, gstin: 1 });
vendorSchema.index({ hotel_id: 1, isActive: 1 });
vendorSchema.index({
  hotel_id: 1,
  name: "text",
  contactPerson: "text",
});

export default mongoose.model("Vendor", vendorSchema);
