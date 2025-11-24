import mongoose from "mongoose";

const securitySchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  type: String,     // IN / OUT
  itemDesc: String,
  vehicleNo: String,
  person: String,
  guardName: String,
  notes: String
}, { timestamps: true });

export default mongoose.model("SecurityLog", securitySchema);
