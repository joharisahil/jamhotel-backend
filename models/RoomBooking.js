import mongoose from "mongoose";

const roomBookingSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  guestName: String,
  guestPhone: String,
  guestEmail: String,
  checkIn: Date,
  checkOut: Date,
  planCode: String,
  adults: Number,
  children: Number,
  status: { type: String, default: "OCCUPIED" },
  advancePaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  addedServices: [{ name: String, price: Number }]
}, { timestamps: true });

roomBookingSchema.index({ hotel_id: 1, room_id: 1 });

export default mongoose.model("RoomBooking", roomBookingSchema);
