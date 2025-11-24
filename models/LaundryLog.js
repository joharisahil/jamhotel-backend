import mongoose from "mongoose";

const laundrySchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  items: [{ desc: String, qty: Number }],
  charges: Number,
  status: { type: String, default: "PENDING" }
}, { timestamps: true });

export default mongoose.model("LaundryLog", laundrySchema);
