import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: String,
  sku: String,
  category: String,
  unit: String,
  quantity: Number,
  minThreshold: Number,
  department: String, 
}, { timestamps: true });

inventoryItemSchema.index({ hotel_id: 1 });

export default mongoose.model("InventoryItem", inventoryItemSchema);
