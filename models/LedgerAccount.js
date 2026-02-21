/**
 * @model LedgerAccount
 * @description Chart of Accounts entry. Balance is NEVER stored here —
 *              it is always derived by aggregating JournalEntry lines.
 *              Direct balance manipulation is strictly forbidden.
 *              Seeded per hotel using ledgerSeeds.js on initial setup.
 */

import mongoose from 'mongoose';
import { LEDGER_ACCOUNT_TYPE } from '../constants/enums.js';

const ledgerAccountSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Account code is required'],
      trim: true,
      maxlength: [20, 'Account code cannot exceed 20 characters'],
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [200, 'Account name cannot exceed 200 characters'],
    },
    type: {
      type: String,
      enum: { values: Object.values(LEDGER_ACCOUNT_TYPE), message: 'Invalid account type' },
      required: [true, 'Account type is required'],
    },
    system: {
  type: Boolean,
  default: false,
},
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerAccount',
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Opening balance (read-only after first entry, enforced in service)
    openingBalance: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────────────

// Account code must be unique per hotel
ledgerAccountSchema.index({ hotel_id: 1, code: 1 }, { unique: true });
ledgerAccountSchema.index({ hotel_id: 1, type: 1, isActive: 1 });
ledgerAccountSchema.index({ hotel_id: 1, name: 'text' });

export default mongoose.model('LedgerAccount', ledgerAccountSchema);
