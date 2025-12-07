// services/banquetService.js
import BanquetHall from "../models/BanquetHall.js";
import BanquetBooking from "../models/BanquetBooking.js";
import Room from "../models/Room.js";
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
export const isHallAvailable = async (hotel_id, hall_id, dateFrom, dateTo) => {
  const overlapping = await BanquetBooking.findOne({
    hotel_id,
    hall_id,
    status: { $nin: ["CANCELLED", "COMPLETED"] },
    $or: [
      { dateFrom: { $lte: new Date(dateTo) }, dateTo: { $gte: new Date(dateFrom) } }
    ]
  });
  return !Boolean(overlapping);
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
    // validate hall exists
    const hall = await BanquetHall.findOne({ _id: payload.hall_id, hotel_id }).session(session);
    if (!hall) throw new Error("Banquet hall not found");

    // availability check
    const available = await isHallAvailable(hotel_id, payload.hall_id, payload.dateFrom, payload.dateTo);
    if (!available) throw new Error("Banquet hall is not available for selected dates");

    // create booking
    const booking = await BanquetBooking.create([{
      hotel_id,
      ...payload,
      status: "OCCUPIED"
    }], { session });

    // reserve linked rooms if provided
    if (payload.linkedRoomIds && payload.linkedRoomIds.length) {
      const roomIds = payload.linkedRoomIds.map(id => mongoose.Types.ObjectId(id));
      // check rooms availability
      const conflicting = await Room.findOne({
        _id: { $in: roomIds },
        hotel_id,
        status: { $in: ["OCCUPIED", "CHECKEDIN"] }
      }).session(session);
      if (conflicting) throw new Error("One or more linked rooms are not available");

      // mark rooms as BOOKED (simple reservation; you may want to create RoomBooking records separately)
      await Room.updateMany(
        { _id: { $in: roomIds }, hotel_id },
        { $set: { status: "OCCUPIED" } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // emit event for real-time UIs
    emitToHotel(hotel_id, "banquet:booking_created", booking[0]);

    return booking[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

/**
 * List bookings with optional filters
 */
export const listBookings = async (hotel_id, filters = {}, options = {}) => {
  const q = { hotel_id, ...filters };
  const query = BanquetBooking.find(q).sort({ dateFrom: -1 });
  if (options.limit) query.limit(options.limit);
  if (options.skip) query.skip(options.skip);
  return query.populate("hall_id").exec();
};

/**
 * Get single booking
 */
export const getBooking = async (bookingId) => {
  return BanquetBooking.findById(bookingId).populate("hall_id").exec();
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
  if ((updates.hall_id && String(updates.hall_id) !== String(booking.hall_id)) ||
      (updates.dateFrom && updates.dateFrom !== booking.dateFrom) ||
      (updates.dateTo && updates.dateTo !== booking.dateTo)) {
    const overlapping = await BanquetBooking.findOne({
      hotel_id,
      _id: { $ne: bookingId },
      hall_id: updates.hall_id || booking.hall_id,
      status: { $nin: ["CANCELLED", "COMPLETED"] },
      $or: [
        { dateFrom: { $lte: new Date(updates.dateTo || booking.dateTo) }, dateTo: { $gte: new Date(updates.dateFrom || booking.dateFrom) } }
      ]
    });
    if (overlapping) throw new Error("Requested hall/date is not available");
  }

  Object.assign(booking, updates);
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

    booking.status = "CANCELLED";
    await booking.save({ session });

    if (booking.linkedRoomIds && booking.linkedRoomIds.length) {
      await Room.updateMany(
        { _id: { $in: booking.linkedRoomIds }, hotel_id },
        { $set: { status: "AVAILABLE" } },
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
