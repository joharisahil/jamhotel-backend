// services/roomService.js
import Room from "../models/Room.js";
import RoomBooking from "../models/RoomBooking.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Utility:
 * Determines whether two datetime ranges overlap.
 *
 * Overlap exists if:
 *   existing.checkIn < requested.checkOut
 *   AND existing.checkOut > requested.checkIn
 *
 * This makes checkOut TIME strictly exclusive.
 */
function isOverlapping(existingIn, existingOut, reqIn, reqOut) {
  return existingIn < reqOut && existingOut > reqIn;
}

/**
 * --------------------------
 * GET AVAILABLE ROOMS FOR DATES (Date + Time)
 * --------------------------
 *
 * Rules:
 * ✔ A room is free if previous booking has checkout <= requested check-in.
 * ✔ A room is only blocked if datetime overlap exists.
 * ✔ Same-day checkout rooms should still appear as AVAILABLE
 *    but must return metadata:
 *    { hasSameDayCheckout: true, checkoutTime: <Date> }
 *
 * This method returns rooms with enriched metadata for frontend.
 */
export const getAvailableRoomsForDates = async (
  hotel_id,
  checkInDT,
  checkOutDT,
  roomType = null
) => {
  const reqIn = new Date(checkInDT);
  const reqOut = new Date(checkOutDT);

  if (isNaN(reqIn) || isNaN(reqOut) || reqIn >= reqOut) {
    throw new Error("Invalid check-in/check-out datetime");
  }

  // 1. Fetch ALL bookings overlapping or adjacent
  const allBookings = await RoomBooking.find({
    hotel_id,
    status: { $nin: ["CANCELLED"] }
  }).select("room_id checkIn checkOut");

  const blockingMap = new Map();
  const sameDayCheckoutMap = new Map();

  for (const b of allBookings) {
    const existingIn = new Date(b.checkIn);
    const existingOut = new Date(b.checkOut);

    // If the existing checkout <= requested checkin → does NOT block the room.
    if (existingOut <= reqIn) {
      // Track that this room has same-day earlier checkout
      // Only record if it's the same calendar date
      const isSameDay =
        existingOut.getFullYear() === reqIn.getFullYear() &&
        existingOut.getMonth() === reqIn.getMonth() &&
        existingOut.getDate() === reqIn.getDate();

      if (isSameDay) {
        sameDayCheckoutMap.set(String(b.room_id), existingOut);
      }
      continue;
    }

    // If existing booking overlaps → block the room
    if (isOverlapping(existingIn, existingOut, reqIn, reqOut)) {
      blockingMap.set(String(b.room_id), existingOut);
    }
  }

  // 2. Fetch all rooms for this hotel
  const roomQuery = { hotel_id };
  if (roomType) roomQuery.type = roomType;

  const rooms = await Room.find(roomQuery).sort({ number: 1 });

  // 3. Build final result array with metadata
  const result = rooms
    .filter(r => !blockingMap.has(String(r._id)))  // remove fully blocked rooms
    .map(r => {
      const rid = String(r._id);

      return {
        ...r.toObject(),
        available: true,
        hasSameDayCheckout: sameDayCheckoutMap.has(rid),
        checkoutTime: sameDayCheckoutMap.get(rid) || null
      };
    });

  return result;
};

/**
 * BASIC ROOM CRUD SERVICES
 */

export const createRoom = async (hotel_id, payload) => {
  const room = await Room.create({ hotel_id, ...payload });
  const qrUrl = `${process.env.QR_URL}/menu/qr/room/${room._id}/${hotel_id}`;

  room.qrUrl = qrUrl;
  room.qrCodeId = `ROOM-${room._id}`;
  await room.save();

  return room;
};

export const listRooms = async (hotel_id, query = {}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Find bookings active today
  const activeBookings = await RoomBooking.find({
    hotel_id,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] },
    checkIn: { $lt: tomorrow },
    checkOut: { $gt: today }
  }).select("room_id");

  const occupiedTodayIds = new Set(activeBookings.map(b => String(b.room_id)));

  const rooms = await Room.find({ hotel_id, ...query });

  return rooms.map(r => ({
    ...r.toObject(),
    liveStatus: occupiedTodayIds.has(String(r._id)) ? "OCCUPIED" : "AVAILABLE"
  }));
};


export const getRoomById = async (id, hotel_id) => {
  return Room.findOne({ _id: id, hotel_id });
};

export const updateRoom = async (id, payload) =>
  Room.findByIdAndUpdate(id, payload, { new: true });

export const updateRoomById = async (id, hotel_id, payload) => {
  return Room.findOneAndUpdate(
    { _id: id, hotel_id },
    payload,
    { new: true }
  );
};

export const deleteRoomById = async (id, hotel_id) => {
  return Room.findOneAndDelete({ _id: id, hotel_id });
};

export const getRoomTypes = async (hotel_id) => {
  return Room.distinct("type", { hotel_id });
};

export const getRoomsByType = async (hotel_id, type) => {
  return Room.find({ hotel_id, type }).select("_id number type");
};

export const getRoomPlans = async (hotel_id, roomId) => {
  const room = await Room.findOne({ _id: roomId, hotel_id });
  if (!room) return null;

  const formatted = [];

  room.plans.forEach(p => {
    if (p.singlePrice) {
      formatted.push({
        key: `${p.code}_SINGLE`,
        label: `${p.name} - Single`,
        price: p.singlePrice,
        code: p.code,
        type: "SINGLE"
      });
    }

    if (p.doublePrice) {
      formatted.push({
        key: `${p.code}_DOUBLE`,
        label: `${p.name} - Double`,
        price: p.doublePrice,
        code: p.code,
        type: "DOUBLE"
      });
    }
  });

  return formatted;
};

export const getAllRoomsWithBookingStatus = async (hotel_id, checkInDT, checkOutDT) => {
  const reqIn = new Date(checkInDT);
  const reqOut = new Date(checkOutDT);

  const bookings = await RoomBooking.find({
    hotel_id,
    status: { $nin: ["CANCELLED"] },
    checkIn: { $lt: reqOut },
    checkOut: { $gt: reqIn }
  });

  const bookingMap = new Map();
  bookings.forEach(b => {
    bookingMap.set(String(b.room_id), b._id);
  });

  const rooms = await Room.find({ hotel_id }).sort({ number: 1 });

  return rooms.map(r => ({
    ...r.toObject(),
    isBooked: bookingMap.has(String(r._id)),
    bookingId: bookingMap.get(String(r._id)) || null,
  }));
};

export const getActiveBookingForToday = async (roomId, hotelId) => {
  const now = new Date();

  return RoomBooking.findOne({
    hotel_id: hotelId,
    room_id: roomId,
    status: { $nin: ["CANCELLED", "CHECKED_OUT"] },

    // Guest should already have checked in
    checkIn: { $lte: now },

    // Guest should not have checked out yet
    checkOut: { $gt: now }
  }).populate("room_id");
};

