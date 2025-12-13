import mongoose from "mongoose";

const roomInvoiceSchema = new mongoose.Schema({
  hotel_id: mongoose.Types.ObjectId,
  room_id: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,

  invoiceNumber: String,

  guestName: String,
  guestPhone: String,

  stayNights: Number,
  roomRate: Number,
  stayAmount: Number,

  extraServices: [
    {
      name: String,
      price: Number,
      days: [Number]
    }
  ],

  stayCGST: Number,
  staySGST: Number,
  stayGST: Number,

  gstEnabled: { type: Boolean, default: true },

  foodOrders: Array,
  foodSubtotal: Number,
  foodGST: Number,
  foodTotal: Number,

  discountPercent: Number,
  discountAmount: Number,

  totalAmount: Number,
  advancePaid: Number,
  balanceDue: Number,

  actualCheckoutTime: Date   // NEW — for billing

}, { timestamps: true });

export default mongoose.model("RoomInvoice", roomInvoiceSchema);
