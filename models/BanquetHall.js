import mongoose from "mongoose";

const banquetHallSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: { type: String, required: true },
  capacity: Number,
  pricePerDay: Number,
  features: [String],
  linkedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }]
}, { timestamps: true });

banquetHallSchema.index({ hotel_id: 1 });

export default mongoose.model("BanquetHall", banquetHallSchema);
