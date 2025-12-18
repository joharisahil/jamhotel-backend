import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: String,
  capacity: Number,
  status: {
    type: String,
    enum: ["AVAILABLE", "OCCUPIED", "BILLING"],
    default: "AVAILABLE",
  },

  activeSession: {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TableSession" },
    startedAt: Date,
  },
  locationDesc: String,
  qrUrl: String,
  qrCodeId: String,
  sessionToken: String,
  sessionExpiresAt: Date,
}, { timestamps: true });

tableSchema.index({ hotel_id: 1 });

export default mongoose.model("Table", tableSchema);
