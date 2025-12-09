import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  phone: String,
  email: String,
  gstNumber: { type: String, default: "" },
  timezone: { type: String, default: "Asia/Kolkata" },
  currency: { type: String, default: "INR" },
  gst_enabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Hotel", hotelSchema);
