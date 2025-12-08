import mongoose from "mongoose";

const roomInvoiceSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "RoomBooking", required: true },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

  invoiceNumber: { type: String, required: true, unique: true },

  guestName: String,
  guestPhone: String,

  // ROOM CHARGES
  stayNights: Number,
  roomRate: Number,
  stayAmount: Number,
  extraServices: [{ name: String, price: Number }],

  // FOOD CHARGES
  foodOrders: [
    {
      order_id: mongoose.Schema.Types.ObjectId,
      items: Array,
      subtotal: Number,
      gst: Number,
      total: Number,
    }
  ],
  foodSubtotal: Number,
  foodGST: Number,
  foodTotal: Number,

  discount: Number,
  totalAmount: Number,
  advancePaid: Number,
  balanceDue: Number,

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("RoomInvoice", roomInvoiceSchema);
