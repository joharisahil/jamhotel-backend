import mongoose from "mongoose";

const banquetPlanItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isVeg: { type: Boolean, required: true },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuCategory",
    required: true,
  },
  allowedQty: { type: Number, default: 1 },
  allowedMenuItems: [
    { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }
  ],
}, { _id: false });

const banquetPlanSchema = new mongoose.Schema({
  hotel_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  ratePerPerson: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  items: [banquetPlanItemSchema],
}, { timestamps: true });

export default mongoose.model("BanquetPlan", banquetPlanSchema);
