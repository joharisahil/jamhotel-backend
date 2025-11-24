import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  code: String,
  name: String,
  rate: Number
}, { _id: false });

const roomSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  number: { type: String, required: true },
  type: String,
  floor: Number,
  status: { type: String, default: "AVAILABLE" }, // AVAILABLE, BOOKED, CLEANING
  baseRate: Number,
  maxGuests: { type: Number, default: 1 },
  plans: [planSchema],
  extras: [{ name: String, price: Number }],
  qrUrl: String,
  qrCodeId: String,
}, { timestamps: true });

roomSchema.index({ hotel_id: 1, number: 1 }, { unique: true });

export default mongoose.model("Room", roomSchema);
