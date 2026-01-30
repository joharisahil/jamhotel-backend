import BanquetHall from "../models/BanquetHall.js";
import BanquetBooking from "../models/BanquetBooking.js";

/**
 * Check hall availability for a date + time range
 */
export const getAvailableHalls = async ({
  hotel_id,
  eventDate,
  startTime,
  endTime,
}) => {
  // 1️⃣ Get all halls for hotel
  const halls = await BanquetHall.find({ hotel_id });

  if (!halls.length) return [];

  // 2️⃣ Find conflicting bookings
  const conflictingBookings = await BanquetBooking.find({
    hotel_id,
    eventDate: new Date(eventDate),
    bookingStatus: { $ne: "CANCELLED" },
    $expr: {
      $and: [
        { $lt: ["$startTime", endTime] },
        { $gt: ["$endTime", startTime] },
      ],
    },
  }).select("hall._id");

  const blockedHallIds = new Set(
    conflictingBookings.map(b => String(b.hall._id))
  );

  // 3️⃣ Return only free halls
  return halls.filter(
    hall => !blockedHallIds.has(String(hall._id))
  );
};
