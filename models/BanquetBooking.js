import mongoose from "mongoose";

const banquetBookingSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  hall_id: { type: mongoose.Schema.Types.ObjectId, ref: "BanquetHall", required: true },
  customerName: String,
  customerPhone: String,
  dateFrom: Date,
  dateTo: Date,
  timeFrom: String,
  timeTo: String,
  guestsCount: Number,
  packageSelected: String,
  cateringItems: [{ name: String, qty: Number, price: Number }],
  linkedRoomIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }],
  advancePaid: Number,
  status: { type: String, default: "BOOKED" }
}, { timestamps: true });

export default mongoose.model("BanquetBooking", banquetBookingSchema);
