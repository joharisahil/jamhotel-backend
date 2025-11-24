import mongoose from "mongoose";

const menuCategorySchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: String,
  order: Number
}, { timestamps: true });

menuCategorySchema.index({ hotel_id: 1 });

export default mongoose.model("MenuCategory", menuCategorySchema);
