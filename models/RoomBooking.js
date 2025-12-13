// models/RoomBooking.js
import mongoose from "mongoose";

const idProofSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Aadhaar Card", "Driving License", "Passport", "Voter ID"],
    required: true
  },
  idNumber: { type: String, required: true },
  nameOnId: { type: String, required: true }
}, { _id: false });

const addedServiceSchema = new mongoose.Schema({
  name: String,
  price: Number,
  days: [Number]
}, { _id: false });

const foodTotalsSchema = new mongoose.Schema({
  subtotal: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const roomBookingSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

  guestName: String,
  guestPhone: String,
  guestEmail: String,

  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },

  // ROOM GST
  gstEnabled: { type: Boolean, default: true },

  planCode: String,
  adults: Number,
  children: Number,

  // ROOM discount
  discount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },

  taxable: Number,
  cgst: Number,
  sgst: Number,

  // FOOD discount
  foodDiscount: { type: Number, default: 0 },          // %
  foodDiscountAmount: { type: Number, default: 0 },     // ₹
  foodGSTEnabled: { type: Boolean, default: true },

  foodTotals: { type: foodTotalsSchema, default: {} },

  guestIds: [idProofSchema],

  addedServices: [addedServiceSchema],

  status: { type: String, default: "OCCUPIED" },

  advancePaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 }

}, { timestamps: true });

roomBookingSchema.index({ hotel_id: 1, room_id: 1 });

export default mongoose.model("RoomBooking", roomBookingSchema);
