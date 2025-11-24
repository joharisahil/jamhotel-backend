import mongoose from "mongoose";

const inventoryLogSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
  qtyChange: Number,
  type: String,   // IN | OUT | ADJUSTMENT
  note: String,
  refId: String
}, { timestamps: true });

export default mongoose.model("InventoryLog", inventoryLogSchema);
