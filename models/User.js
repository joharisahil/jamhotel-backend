import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  phone: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.index({ hotel_id: 1, email: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
