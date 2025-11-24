import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  table_id: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
  issueType: String,
  description: String,
  reportedByName: String,
  reportedByPhone: String,
  status: { type: String, default: "NEW" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("MaintenanceLog", maintenanceSchema);
