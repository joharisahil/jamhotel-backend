import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuCategory", required: true },
  name: String,
  description: String,
  priceSingle: Number, 
  priceHalf: Number,
  priceFull: Number,
  isVeg:{ type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  imageUrl: String,
  gstPercent: { type: Number, default: 5 },
  prepTimeMins: Number
}, { timestamps: true });

menuItemSchema.index({ hotel_id: 1 });

export default mongoose.model("MenuItem", menuItemSchema);
