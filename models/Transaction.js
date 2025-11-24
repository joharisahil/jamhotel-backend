// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    // CREDIT or DEBIT
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    // Which department or feature the revenue/expense belongs to
    source: {
      type: String,
      enum: [
        "ROOM",
        "RESTAURANT",
        "BANQUET",
        "MAINTENANCE",
        "LAUNDRY",
        "INVENTORY",
        "OTHER",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      default: "",
    },

    // for linking to booking/order/etc.
    referenceId: {
      type: String,
      default: null,
    },

    // Optional: payment mode
    paymentMode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "ONLINE", "OTHER"],
      default: "CASH",
    },

    // For audit purposes
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for performance in large hotels
transactionSchema.index({ hotel_id: 1, createdAt: -1 });
transactionSchema.index({ hotel_id: 1, source: 1 });
transactionSchema.index({ referenceId: 1 });

export default mongoose.model("Transaction", transactionSchema);
