import mongoose from "mongoose";

const tableSessionSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED"],
      default: "ACTIVE",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    closedAt: Date,

    customerName: String,
    customerPhone: String,
  },
  { timestamps: true }
);

/**
 * 🔥 ABSOLUTE GUARANTEE
 * Only ONE ACTIVE session per table per hotel
 */
tableSessionSchema.index(
  { hotel_id: 1, table_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" }
  }
);

export default mongoose.model("TableSession", tableSessionSchema);
