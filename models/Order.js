import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
  name: String,
  size: String, // HALF or FULL
  qty: Number,
  unitPrice: Number,
  totalPrice: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  source: String, // QR, TABLE, ROOM
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  guestName: String,
  guestPhone: String,
  items: [orderItemSchema],
  subtotal: Number,
  gst: Number,
  total: Number,
  status: { type: String, default: "NEW" }, 
}, { timestamps: true });

orderSchema.index({ hotel_id: 1 });

export default mongoose.model("Order", orderSchema);
