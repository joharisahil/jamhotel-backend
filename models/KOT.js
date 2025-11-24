import mongoose from "mongoose";

const kotItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
  name: String,
  size: String,
  qty: Number,
  status: { type: String, default: "PENDING" }
}, { _id: false });

const kotSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  ticketNumber: String,
  items: [kotItemSchema],
  status: { type: String, default: "PENDING" },
  kitchenStation: String
}, { timestamps: true });

export default mongoose.model("KOT", kotSchema);
