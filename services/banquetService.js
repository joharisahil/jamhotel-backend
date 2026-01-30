// services/banquetService.js
import BanquetHall from "../models/BanquetHall.js";
import BanquetBooking from "../models/BanquetBooking.js";
import Room from "../models/Room.js";
import BanquetPlan from "../models/BanquetPlan.js";
import { calculateTotals } from "../utils/banquetTotals.js";
import mongoose from "mongoose";
import { emitToHotel } from "../utils/socket.js";

/**
 * Create a banquet hall
 */
export const createHall = async (hotel_id, payload) => {
  const hall = await BanquetHall.create({ hotel_id, ...payload });
  return hall;
};

/**
 * List halls for a hotel
 */
export const listHalls = async (hotel_id) => {
  return BanquetHall.find({ hotel_id }).sort({ name: 1 });
};

/**
 * Get single hall
 */
export const getHall = async (hallId) => {
  return BanquetHall.findById(hallId);
};

/**
 * Update hall
 */
export const updateHall = async (hallId, payload) => {
  return BanquetHall.findByIdAndUpdate(hallId, payload, { new: true });
};

/**
 * Delete (soft) hall
 */
export const deleteHall = async (hallId) => {
  // For now hard delete; change to soft-delete if desired
  return BanquetHall.findByIdAndDelete(hallId);
};

/**
 * Check hall availability for given date range
 * returns true if available, false if any overlapping booking exists
 */
export const isHallAvailable = async (
  hotel_id,
  hallId,
  eventDate,
  startTime,
  endTime
) => {
  const conflict = await BanquetBooking.findOne({
    hotel_id,
    "hall._id": hallId,
    eventDate: new Date(eventDate),
    bookingStatus: { $ne: "CANCELLED" },
    $expr: {
      $and: [
        { $lt: ["$startTime", endTime] },
        { $gt: ["$endTime", startTime] },
      ],
    },
  });

  return !Boolean(conflict);
};

/**
 * Create banquet booking
 * If linkedRoomIds provided, reserve those rooms (transactionally)
 * payload expected fields:
 * { hall_id, customerName, customerPhone, dateFrom, dateTo, timeFrom, timeTo, guestsCount, packageSelected, cateringItems, linkedRoomIds[], advancePaid }
 */
export const createBooking = async (hotel_id, payload) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /* ---------- HALL VALIDATION ---------- */
    const hallDoc = await BanquetHall.findOne({
      _id: payload.hallId,
      hotel_id,
    }).session(session);

    if (!hallDoc) throw new Error("Hall not found");

    /* ---------- PLAN SNAPSHOT ---------- */
    let planSnapshot = null;

    if (payload.pricingMode === "PLAN") {
      const plan = await BanquetPlan.findOne({
        _id: payload.planId,
        hotel_id,
        isActive: true,
      }).session(session);

      if (!plan) throw new Error("Plan not found");

      planSnapshot = {
        _id: plan._id,
        name: plan.name,
        ratePerPerson: plan.ratePerPerson,
        items: payload.planItems, // frontend-modified snapshot
      };
    }

    /* ---------- BUILD BOOKING ---------- */
    const booking = new BanquetBooking({
      hotel_id,

      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      eventType: payload.eventType,
      notes: payload.notes,

      eventDate: payload.eventDate,
      startTime: payload.startTime,
      endTime: payload.endTime,

      hall: {
        _id: hallDoc._id,
        name: hallDoc.name,
        capacity: hallDoc.capacity,
        baseCharge: hallDoc.pricePerDay,
        isComplimentary: payload.isHallComplimentary || false,
      },

      guestsCount: payload.guestsCount,
      linkedRoomIds: payload.linkedRoomIds || [],

      pricingMode: payload.pricingMode,
      plan: planSnapshot,
      customFoodAmount: payload.customFoodAmount,

      services: payload.services || [],
      discount: payload.discount,
      gstPercent: payload.gstPercent || 18,
      payments: payload.payments || [],
    });

    /* ---------- TOTALS ---------- */
    booking.totals = calculateTotals(booking);

    /* ---------- STATUS ---------- */
    booking.bookingStatus =
      booking.totals.paidAmount === 0
        ? "ENQUIRY"
        : booking.totals.balanceAmount > 0
        ? "TENTATIVE"
        : "CONFIRMED";

    await booking.save({ session });
    await session.commitTransaction();

    return booking;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * List bookings with optional filters
 */
export const listBookings = async (hotel_id, filters = {}, options = {}) => {
  const q = { hotel_id, ...filters };
  const query = BanquetBooking.find(q).sort({ eventDate: -1 });
  if (options.limit) query.limit(options.limit);
  if (options.skip) query.skip(options.skip);
  return query.exec();
};

/**
 * Get single booking
 */
export const getBooking = async (bookingId) => {
  return BanquetBooking.findById(bookingId).exec();
};

/**
 * Update booking (modify date/time/guests/packages)
 * NOTE: if dates/hall change, re-check availability
 */
export const updateBooking = async (bookingId, hotel_id, updates) => {
  const booking = await BanquetBooking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (String(booking.hotel_id) !== String(hotel_id)) throw new Error("Forbidden");

  // if hall or date range changed, check availability (exclude current booking)
if (
  updates.eventDate ||
  updates.startTime ||
  updates.endTime ||
  updates.hall?._id
) {
  const overlapping = await BanquetBooking.findOne({
    hotel_id,
    _id: { $ne: bookingId },
    "hall._id": updates.hall?._id || booking.hall._id,
    eventDate: new Date(updates.eventDate || booking.eventDate),
    bookingStatus: { $nin: ["CANCELLED", "COMPLETED"] },
    $expr: {
      $and: [
        { $lt: ["$startTime", updates.endTime || booking.endTime] },
        { $gt: ["$endTime", updates.startTime || booking.startTime] },
      ],
    },
  });

  if (overlapping) {
    throw new Error("Requested hall/time slot is not available");
  }
}

  Object.assign(booking, updates);
  // 🔥 RE-CALCULATE TOTALS
  booking.totals = calculateTotals(booking);

  // 🔥 RE-CALCULATE STATUS
  booking.bookingStatus =
  booking.totals.paidAmount === 0
    ? "ENQUIRY"
    : booking.totals.balanceAmount > 0
    ? "TENTATIVE"
    : "CONFIRMED";
  await booking.save();

  emitToHotel(hotel_id, "banquet:booking_updated", booking);
  return booking;
};

/**
 * Cancel booking
 * If linked rooms were reserved earlier, free them
 */
export const cancelBooking = async (bookingId, hotel_id) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await BanquetBooking.findById(bookingId).session(session);
    if (!booking) throw new Error("Booking not found");
    if (String(booking.hotel_id) !== String(hotel_id)) throw new Error("Forbidden");

    booking.bookingStatus = "CANCELLED";
    await booking.save({ session });

    if (booking.linkedRoomIds && booking.linkedRoomIds.length) {
      await Room.updateMany(
        { _id: { $in: booking.linkedRoomIds }, hotel_id },
        { $set: { bookingStatus: "AVAILABLE" } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    emitToHotel(hotel_id, "banquet:booking_cancelled", booking);
    return booking;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
