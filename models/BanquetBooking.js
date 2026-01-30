import mongoose from "mongoose";

/* ================= SUB-SCHEMAS ================= */

// Snapshot of plan items at booking time
const planItemSchema = new mongoose.Schema({
  title: String,                     // e.g. "Veg Snacks"
  isVeg: Boolean,
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuCategory",
  },
  allowedQty: Number,                // how many items customer can choose
  selectedMenuItems: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,                  // snapshot of menu item name
      isVeg: Boolean,
    },
  ],
  extraItems: [
    {
      name: String,
      charge: Number,
      complimentary: Boolean,
    },
  ],
}, { _id: false });

const serviceSchema = new mongoose.Schema({
  name: String,
  amount: Number,
  chargeable: Boolean,
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  type: { type: String, enum: ["ADVANCE", "FINAL"] },
  amount: Number,
  mode: String,                     // CASH | UPI | CARD | BANK
  date: Date,
  reference: String,
}, { _id: false });

/* ================= MAIN BOOKING ================= */

const banquetBookingSchema = new mongoose.Schema({
  /* ---------- TENANT ---------- */
  hotel_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
    index: true,
  },

  /* ---------- CUSTOMER ---------- */
  customerName: String,
  customerPhone: String,
  eventType: String,
  notes: String,

  /* ---------- DATE & TIME ---------- */
  eventDate: Date,
  startTime: String,
  endTime: String,

  /* ---------- HALL SNAPSHOT ---------- */
  hall: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BanquetHall",
    },
    name: String,
    capacity: Number,
    baseCharge: Number,
    isComplimentary: { type: Boolean, default: false },
  },

  /* ---------- GUESTS & ROOMS ---------- */
  guestsCount: Number,
  linkedRoomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
  }],

  /* ---------- PRICING MODE ---------- */
  pricingMode: {
    type: String,
    enum: ["PLAN", "CUSTOM_FOOD", "HALL_ONLY"],
    required: true,
  },

  /* ---------- PLAN SNAPSHOT ---------- */
  plan: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BanquetPlan",
    },
    name: String,
    ratePerPerson: Number,
    items: [planItemSchema],
  },

  /* ---------- CUSTOM FOOD ---------- */
  customFoodAmount: Number,

  /* ---------- SERVICES ---------- */
  services: [serviceSchema],

  /* ---------- DISCOUNT ---------- */
  discount: {
    type: {
      type: String,
      enum: ["PERCENT", "FLAT"],
    },
    value: Number,
    reason: String,
  },

  /* ---------- TAX ---------- */
  gstPercent: { type: Number, default: 18 },
  gstEnabled: { type: Boolean, default: false },

  /* ---------- PAYMENTS ---------- */
  payments: [paymentSchema],

  /* ---------- DERIVED TOTALS ---------- */
  totals: {
    foodAmount: Number,
    hallAmount: Number,
    servicesAmount: Number,
    discountAmount: Number,
    gstAmount: Number,
    grandTotal: Number,
    paidAmount: Number,
    balanceAmount: Number,
  },

  /* ---------- STATUS ---------- */
  bookingStatus: {
    type: String,
    enum: ["ENQUIRY", "TENTATIVE", "CONFIRMED", "CANCELLED", "COMPLETED"],
    default: "ENQUIRY",
  },

}, { timestamps: true });

export default mongoose.model("BanquetBooking", banquetBookingSchema);
