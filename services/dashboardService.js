import Bill from "../models/Bill.js";
import RoomInvoice from "../models/RoomInvoice.js";
import mongoose from "mongoose";

/**
 * MAIN SERVICE
 */
export const getRevenueSummary = async (hotel_id, range) => {
  const { start, end } = getDateRange(range);
  const { start: prevStart, end: prevEnd } = getPreviousRange(range, start);

  const hotelObjectId = new mongoose.Types.ObjectId(hotel_id);

  const [roomNow, roomPrev, restNow, restPrev] = await Promise.all([
    // ROOM revenue (current)
    RoomInvoice.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),

    // ROOM revenue (previous)
    RoomInvoice.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          createdAt: { $gte: prevStart, $lte: prevEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),

    // RESTAURANT revenue (current)
    Bill.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          source: "RESTAURANT",
          createdAt: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]),

    // RESTAURANT revenue (previous)
    Bill.aggregate([
      {
        $match: {
          hotel_id: hotelObjectId,
          source: "RESTAURANT",
          createdAt: { $gte: prevStart, $lte: prevEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]),
  ]);

  const roomCurrent = roomNow[0]?.total || 0;
  const roomPrevious = roomPrev[0]?.total || 0;

  const restCurrent = restNow[0]?.total || 0;
  const restPrevious = restPrev[0]?.total || 0;

  return {
    room: {
      total: roomCurrent,
      growth: calculateGrowth(roomCurrent, roomPrevious),
    },
    restaurant: {
      total: restCurrent,
      growth: calculateGrowth(restCurrent, restPrevious),
    },
  };
};

/* ---------------- HELPER FUNCTIONS ---------------- */

function calculateGrowth(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getDateRange(range) {
  const now = new Date();
  let start;
  const end = new Date();

  switch (range) {
    case "TODAY":
      start = new Date();
      start.setHours(0, 0, 0, 0);
      break;

    case "WEEK":
      start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
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

function getPreviousRange(range, start) {
  let prevStart, prevEnd;

  switch (range) {
    case "TODAY":
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(start);
      break;

    case "WEEK":
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      break;

    case "MONTH":
      prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      prevEnd = new Date(start);
      break;

    case "YEAR":
      prevStart = new Date(start.getFullYear() - 1, 0, 1);
      prevEnd = new Date(start);
      break;
  }

  return { start: prevStart, end: prevEnd };
}
