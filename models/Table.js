import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: String,
  capacity: Number,
  status: { type: String, default: "AVAILABLE" },
  locationDesc: String,
  qrUrl: String,
  qrCodeId: String,
}, { timestamps: true });

tableSchema.index({ hotel_id: 1 });

export default mongoose.model("Table", tableSchema);
