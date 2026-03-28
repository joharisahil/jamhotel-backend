import mongoose, { set } from "mongoose";

/* ===================== SUB SCHEMAS ===================== */

const idProofSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "AADHAAR CARD",
        "DRIVING LICENSE",
        "PASSPORT",
        "VOTER ID",
        "PAN CARD",
      ],
      required: true,
      uppercase: true,
      trim: true,
    },

    idNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    nameOnId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
  },
  { _id: false },
);

const addedServiceSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    gstEnabled: { type: Boolean, default: true },
    days: [Number],
  },
  { _id: false },
);

const foodTotalsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

/* ===================== NEW ADVANCE SCHEMA ===================== */

const advanceSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    mode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
      default: "CASH",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    note: String,
  },
  { _id: true, timestamps: true },
);

/* ===================== MAIN SCHEMA ===================== */

const roomBookingSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    /* -------- Booking Source -------- */
    source: {
      type: String,
      enum: ["WALK_IN", "OTA", "BANQUET", "CORPORATE"],
      default: "WALK_IN",
    },

    /* -------- Guest -------- */
    guestName: String,
    guestPhone: String,
    guestEmail: String,

    guestCity: String,
    guestNationality: String,
    guestAddress: String,

    /* -------- Company -------- */
    companyName: String,
    companyGSTIN: String,
    companyAddress: String,

    /* -------- Dates -------- */
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    actualCheckoutTime: { type: Date, default: null },

    /* -------- Billing -------- */
    roundOffEnabled: { type: Boolean, default: true },
    roundOffAmount: { type: Number, default: 0 },

    gstEnabled: { type: Boolean, default: true },

    planCode: String,
    pricingType: {
      type: String,
      enum: ["BASE_EXCLUSIVE", "FINAL_INCLUSIVE"],
      default: "BASE_EXCLUSIVE",
    },

    finalRoomPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    adults: { type: Number, default: 0 },
    children: { type: Number, default: 0 },

    /* -------- Discounts -------- */
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountScope: {
      type: String,
      enum: ["TOTAL", "ROOM", "EXTRAS"],
      default: "TOTAL",
    },

    /* -------- Taxes -------- */
    taxable: Number,
    cgst: Number,
    sgst: Number,

    /* -------- Food -------- */
    foodDiscount: { type: Number, default: 0 },
    foodDiscountAmount: { type: Number, default: 0 },
    foodGSTEnabled: { type: Boolean, default: true },
    foodTotals: { type: foodTotalsSchema, default: {} },

    /* -------- Extras -------- */
    guestIds: {
      type: [idProofSchema],
      default: [],
    },

    addedServices: [addedServiceSchema],

    /* -------- Status -------- */
    status: {
      type: String,
      enum: [
        "CONFIRMED", // future booking
        "OCCUPIED", // guest currently staying
        "CHECKEDOUT", // stay completed
        "CANCELLED", // cancelled booking
        "NO_SHOW", // optional but VERY useful
        "BLOCKED", // admin block
        "MAINTENANCE", // room out of service
      ],
      default: "OCCUPIED",
    },

    /* =====================================================
       🟢 MULTIPLE ADVANCE PAYMENTS (NEW)
       ===================================================== */
    advances: {
      type: [advanceSchema],
      default: [],
    },

    /* -------- Derived (BACKEND ONLY) -------- */
    grandTotal: { type: Number, default: 0 },
    advancePaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    /* -------- Final Payment -------- */
    finalPaymentReceived: { type: Boolean, default: false },
    finalPaymentMode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
      default: null,
    },
    finalPaymentAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/* ===================== INDEXES ===================== */
roomBookingSchema.index({ hotel_id: 1, room_id: 1 });
roomBookingSchema.index({
  hotel_id: 1,
  checkIn: 1,
  checkOut: 1,
});

export default mongoose.model("RoomBooking", roomBookingSchema);

// // models/RoomBooking.js - Add actualCheckoutTime field

// import mongoose from "mongoose";

// const idProofSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ["Aadhaar Card", "Driving License", "Passport", "Voter ID"],
//     required: true
//   },
//   idNumber: { type: String, required: true },
//   nameOnId: { type: String, required: true }
// }, { _id: false });

// const addedServiceSchema = new mongoose.Schema({
//   name: String,
//   price: Number,
//   gstEnabled: { type: Boolean, default: true },
//   days: [Number]
// }, { _id: false });

// const foodTotalsSchema = new mongoose.Schema({
//   subtotal: { type: Number, default: 0 },
//   gst: { type: Number, default: 0 },
//   total: { type: Number, default: 0 },
// }, { _id: false });

// const roomBookingSchema = new mongoose.Schema({
//   hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
//   room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },

//   guestName: String,
//   guestPhone: String,
//   guestEmail: String,

//   guestCity: String,
//   guestNationality: String,
//   guestAddress: String,

//   companyName: String,
//   companyGSTIN: String,
//   companyAddress: String,

//   roundOffEnabled: { type: Boolean, default: true },
//   roundOffAmount: { type: Number, default: 0 },

//   checkIn: { type: Date, required: true },
//   checkOut: { type: Date, required: true },

//   gstEnabled: { type: Boolean, default: true },

//   planCode: String,
//   adults: Number,
//   children: Number,

//   discount: { type: Number, default: 0 },
//   discountAmount: { type: Number, default: 0 },
//   discountScope: {
//     type: String,
//     enum: ["TOTAL", "ROOM", "EXTRAS"],
//     default: "TOTAL"
//   },

//   taxable: Number,
//   cgst: Number,
//   sgst: Number,

//   foodDiscount: { type: Number, default: 0 },
//   foodDiscountAmount: { type: Number, default: 0 },
//   foodGSTEnabled: { type: Boolean, default: true },

//   foodTotals: { type: foodTotalsSchema, default: {} },

//   guestIds: [idProofSchema],

//   addedServices: [addedServiceSchema],

//   status: { type: String, default: "OCCUPIED" },

//   advancePaid: { type: Number, default: 0 },
//   advancePaymentMode: {
//     type: String,
//     enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
//     default: "CASH"
//   },

//   balanceDue: { type: Number, default: 0 },

//   // Final payment fields
//   finalPaymentReceived: { type: Boolean, default: false },
//   finalPaymentMode: {
//     type: String,
//     enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER", "ONLINE", "OTHER"],
//     default: null
//   },
//   finalPaymentAmount: { type: Number, default: 0 },

//   // NEW FIELD - stores when checkout actually happened
//   actualCheckoutTime: { type: Date, default: null }

// }, { timestamps: true });

// roomBookingSchema.index({ hotel_id: 1, room_id: 1 });

// export default mongoose.model("RoomBooking", roomBookingSchema);

// models/RoomBooking.js
