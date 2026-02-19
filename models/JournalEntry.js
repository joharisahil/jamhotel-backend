/**
 * @model JournalEntry
 * @description Immutable double-entry bookkeeping record.
 *              RULE: totalDebit MUST equal totalCredit (enforced on schema + service layer).
 *              Corrections are made via reversal entries, never by editing existing entries.
 *              Sequential entry numbers are enforced by journalService.
 */

import mongoose from "mongoose";
import {
  JOURNAL_ENTRY_TYPE,
  JOURNAL_REFERENCE_TYPE,
} from "../constants/enums.js";

const { Schema, model } = mongoose;

/* ── Journal Line Sub-document ──────────────────────────────────── */

const journalLineSchema = new Schema(
  {
    account_id: {
      type: Schema.Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
    },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    entryType: {
      type: String,
      enum: Object.values(JOURNAL_ENTRY_TYPE),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Journal line amount must be positive"],
    },
    description: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

/* ── Main Schema ────────────────────────────────────────────────── */

const journalEntrySchema = new Schema(
  {
    hotel_id: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    entryNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    referenceType: {
      type: String,
      enum: Object.values(JOURNAL_REFERENCE_TYPE),
      required: true,
    },

    reference_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    referenceNumber: {
      type: String,
      required: true,
      trim: true,
    },

    lines: {
      type: [journalLineSchema],
      validate: {
        validator: (lines) => lines && lines.length >= 2,
        message:
          "A journal entry must have at least two lines (debit and credit)",
      },
    },

    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },

    narration: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },

    reversalEntry_id: {
      type: Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },

    reversalOf: {
      type: Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ── Indexes ───────────────────────────────────────────────────── */

journalEntrySchema.index({ hotel_id: 1, entryNumber: 1 }, { unique: true });
journalEntrySchema.index({ hotel_id: 1, referenceType: 1, reference_id: 1 });
journalEntrySchema.index({ hotel_id: 1, createdAt: -1 });
journalEntrySchema.index({ hotel_id: 1, isReversed: 1 });

/* ── Pre-save: enforce balanced entry ──────────────────────────── */

journalEntrySchema.pre("save", function (next) {
  const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

  const debit = this.lines
    .filter((l) => l.entryType === DEBIT)
    .reduce((s, l) => s + l.amount, 0);

  const credit = this.lines
    .filter((l) => l.entryType === CREDIT)
    .reduce((s, l) => s + l.amount, 0);

  const diff = Math.abs(debit - credit);

  if (diff > 0.005) {
    return next(
      new Error(
        `Unbalanced journal entry: Debit ₹${debit.toFixed(
          2
        )} ≠ Credit ₹${credit.toFixed(2)}`
      )
    );
  }

  this.totalDebit = parseFloat(debit.toFixed(2));
  this.totalCredit = parseFloat(credit.toFixed(2));

  next();
});

/* ── Guard: prevent updates to journal entries ─────────────────── */

journalEntrySchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function () {
    const update = this.getUpdate();

    const allowedKeys = ["isReversed", "reversalEntry_id"];
    const setKeys = update?.$set ? Object.keys(update.$set) : [];

    const forbidden = setKeys.filter((k) => !allowedKeys.includes(k));

    if (forbidden.length > 0) {
      throw new Error(
        `JournalEntry is immutable. Cannot update fields: ${forbidden.join(
          ", "
        )}`
      );
    }
  }
);

export default model("JournalEntry", journalEntrySchema);
