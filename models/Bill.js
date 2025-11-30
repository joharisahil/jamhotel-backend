import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    billNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // The origin of the bill (room / restaurant / banquet)
    source: {
      type: String,
      enum: ["ROOM", "RESTAURANT", "BANQUET", "OTHER"],
      default: "RESTAURANT",
    },

    // For quick lookup (room booking id, banquet booking id, order bill etc)
    referenceId: {
      type: String,
      default: null,
      index: true,
    },

    table_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
    },

    // optional room/banquet refs could be included in referenceId or separate fields
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },

    customerName: {
      type: String,
      default: "",
    },

    customerPhone: {
      type: String,
      default: "",
    },

    orders: [
      {
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        total: Number,
        items: Array,
      },
    ],

    subtotal: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },

    paymentMode: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "ONLINE", "OTHER"],
      default: "CASH",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

billSchema.index({ hotel_id: 1, billNumber: -1 });
billSchema.index({ source: 1, createdAt: -1 });

export default mongoose.model("Bill", billSchema);
