import Bill from "../models/Bill.js";
import RoomInvoice from "../models/RoomInvoice.js";
import mongoose from "mongoose";

export const getDownloadSummary = async (hotel_id, range, type) => {
  const { start, end } = getDateRange(range);
  const hotelObjectId = new mongoose.Types.ObjectId(hotel_id);

  let rows = [];

  /* ---------------- ROOM SUMMARY ---------------- */
  if (type === "ROOM" || type === "ALL") {
    const roomData = await RoomInvoice.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$finalPaymentMode",
          total: { $sum: "$grandTotal" },
        },
      },
    ]);

    roomData.forEach(r => {
      rows.push({
        Source: "ROOM",
        PaymentMode: r._id || "UNKNOWN",
        Amount: r.total,
      });
    });
  }

  /* ---------------- RESTAURANT SUMMARY ---------------- */
  if (type === "RESTAURANT" || type === "ALL") {
    const restData = await Bill.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          source: "RESTAURANT",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$paymentMode",
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    restData.forEach(r => {
      rows.push({
        Source: "RESTAURANT",
        PaymentMode: r._id || "UNKNOWN",
        Amount: r.total,
      });
    });
  }

  return rows;
};

/* ---------------- HELPERS ---------------- */

function getDateRange(range) {
  const now = new Date();
  let start;
  const end = new Date();

  switch (range) {
    case "TODAY":
      start = new Date();
      start.setHours(0,0,0,0);
      break;
    case "WEEK":
      start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0,0,0,0);
      break;
    case "MONTH":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "YEAR":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      throw new Error("Invalid range");
  }

  return { start, end };
}
