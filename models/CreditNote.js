/**
 * @model CreditNote
 * @description Represents a vendor credit raised against a POSTED invoice.
 *              Creates a reversal JournalEntry and may trigger stock OUT.
 *              Credit notes are immutable after creation.
 */

import mongoose from 'mongoose';

const creditNoteLineSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    itemSku: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Quantity must be positive'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    gstPercentage: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },

    // Stock deduction for returned perishables
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryBatch',
      default: null,
    },
    batchNumber: {
      type: String,
      default: '',
    },
    restoreStock: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const creditNoteSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },

    creditNoteNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    originalInvoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseInvoice',
      required: [true, 'Original invoice reference is required'],
    },

    originalInvoiceNumber: {
      type: String,
      required: true,
    },

    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },

    vendorName: {
      type: String,
      required: true,
    },

    items: {
      type: [creditNoteLineSchema],
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    gstAmount: {
      type: Number,
      default: 0,
    },

    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },

    // Journal reference
    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ─────────────────────────────────────────────────────
creditNoteSchema.index(
  { hotel_id: 1, creditNoteNumber: 1 },
  { unique: true }
);

creditNoteSchema.index({ hotel_id: 1, originalInvoice_id: 1 });
creditNoteSchema.index({ hotel_id: 1, vendor_id: 1, createdAt: -1 });

export default mongoose.model('CreditNote', creditNoteSchema);
