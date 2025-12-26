// models/RoomInvoice.js - Complete schema with all fields

import mongoose from "mongoose";

const roomInvoiceSchema = new mongoose.Schema({
  hotel_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Hotel",
    required: true 
  },

  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true
  },

  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RoomBooking",
    required: true
  },

  invoiceNumber: { 
    type: String, 
    required: true,
    unique: true 
  },

  // Room details
  roomNumber: String,
  roomType: String,

  // Guest Information
  guestName: String,
  guestPhone: String,
  guestCity: String,
  guestNationality: String,
  guestAddress: String,
  adults: Number,
  children: Number,

  // Company Details
  companyName: String,
  companyGSTIN: String,
  companyAddress: String,

  // Stay Details
  checkIn: Date,
  checkOut: Date,
  stayNights: Number,
  planCode: String,

  // Room Charges
  roomRate: Number,
  stayAmount: Number,

  extraServices: [
    {
      name: String,
      price: Number,
      gstEnabled: { type: Boolean, default: true },
      days: [Number]
    }
  ],

  // Room GST
  stayCGST: { type: Number, default: 0 },
  staySGST: { type: Number, default: 0 },
  stayGST: { type: Number, default: 0 },
  gstEnabled: { type: Boolean, default: true },

  // Room Discount
  discountPercent: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  roomGross: Number,
  roomNet: Number,

  // Food Orders
  foodOrders: {
    type: Array,
    default: []
  },

  foodSubtotalRaw: { type: Number, default: 0 },
  foodDiscountPercent: { type: Number, default: 0 },
  foodDiscountAmount: { type: Number, default: 0 },
  foodSubtotalAfterDiscount: { type: Number, default: 0 },
  foodCGST: { type: Number, default: 0 },
  foodSGST: { type: Number, default: 0 },
  foodGST: { type: Number, default: 0 },
  foodTotal: { type: Number, default: 0 },
  foodGSTEnabled: { type: Boolean, default: true },

  // Final Totals
  grandTotal: Number,
  totalAmount: Number, // Kept for backward compatibility
  advancePaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },

  // Payment Information
  advancePaymentMode: {
    type: String,
    enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
    default: "CASH"
  },
  finalPaymentMode: {
    type: String,
    enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
    default: null
  },
  finalPaymentReceived: { 
    type: Boolean, 
    default: false 
  },
  finalPaymentAmount: { 
    type: Number, 
    default: 0 
  },

  actualCheckoutTime: Date

}, { timestamps: true });

// Indexes for better query performance
roomInvoiceSchema.index({ hotel_id: 1, createdAt: -1 });
roomInvoiceSchema.index({ invoiceNumber: 1 });
roomInvoiceSchema.index({ bookingId: 1 });

export default mongoose.model("RoomInvoice", roomInvoiceSchema);