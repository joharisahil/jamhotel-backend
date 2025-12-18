import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
  name: String,
  size: { type: String, enum: ["HALF", "FULL", "SINGLE"] },
  qty: Number,
  unitPrice: Number,
  totalPrice: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },

  guestName: String,
  guestPhone: String,

  items: [orderItemSchema],

  subtotal: Number,
  gst: Number,
  total: Number,

  status: { type: String, default: "NEW" },

  tableSession_id: {
   type: mongoose.Schema.Types.ObjectId,
   ref: "TableSession",
  },

  source: {
   type: String,
   enum: [
    "QR",
    "MANUAL",
    "RESTAURANT_TRANSFER",
    "ROOM_SERVICE"
  ],
   required: true,
  },

  // ------------------------------
  // BILLING FIELDS (add these)
  // ------------------------------
  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID"],
    default: "PENDING",
  },

  billNumber: {
    type: String,
    default: null,
  },

  discount: {
    type: Number,
    default: 0,
  },

  paidAt: {
    type: Date,
    default: null,
  },

}, { timestamps: true });

orderSchema.index({ hotel_id: 1 });

export default mongoose.model("Order", orderSchema);
