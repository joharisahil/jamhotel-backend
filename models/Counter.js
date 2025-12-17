import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  hotel_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

counterSchema.index({ hotel_id: 1, key: 1 }, { unique: true });

export default mongoose.model("Counter", counterSchema);
