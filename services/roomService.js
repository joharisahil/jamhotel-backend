import Room from "../models/Room.js";
import RoomBooking from "../models/RoomBooking.js";

export const createRoom = async (hotel_id, payload) => {
  const room = await Room.create({ hotel_id, ...payload });
    // Auto-generate QR URL
  const qrUrl = `${process.env.QR_URL}/menu/qr/room/${room._id}/${hotel_id}`;

  room.qrUrl = qrUrl;
  room.qrCodeId = `ROOM-${room._id}`;

  await room.save();
  
  return room;
};

export const listRooms = async (hotel_id, query = {}) => {
  return Room.find({ hotel_id, ...query });
};

export const getRoomById = async (id, hotel_id) => {
  return Room.findOne({ _id: id, hotel_id });
};

export const updateRoom = async (id, payload) => Room.findByIdAndUpdate(id, payload, { new: true });

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
  return await Room.distinct("type", { hotel_id });
};

export const getRoomsByType = async (hotel_id, type) => {
  return await Room.find({ hotel_id, type }).select("_id number type");
};

export const getRoomPlans = async (hotel_id, roomId) => {
  const room = await Room.findOne({ _id: roomId, hotel_id });

  if (!room) return null;

  let formattedPlans = [];

  room.plans.forEach((p) => {
    if (p.singlePrice) {
      formattedPlans.push({
        key: `${p.code}_SINGLE`,
        label: `${p.name} - Single`,
        price: p.singlePrice,
        code: p.code,
        type: "SINGLE",
      });
    }

    if (p.doublePrice) {
      formattedPlans.push({
        key: `${p.code}_DOUBLE`,
        label: `${p.name} - Double`,
        price: p.doublePrice,
        code: p.code,
        type: "DOUBLE",
      });
    }
  });

  return formattedPlans;
};

// services/roomService.js  (replace the function implementation)
export const getAvailableRoomsForDates = async (hotel_id, checkIn, checkOut, roomType = null) => {
  // normalize dates from input (assumes YYYY-MM-DD input)
  // treat checkOut as EXCLUSIVE: a booking that checks out on day X
  // does not conflict with a new booking that checks in on day X.
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  // Defensive: ensure valid dates
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("Invalid date range");
  }

  // Overlap condition (strict):
  // existingBooking.checkIn < newEnd  AND existingBooking.checkOut > newStart
  // This makes checkOut exclusive (no overlap when existing.checkOut === newStart)
  const overlappingBookings = await RoomBooking.find({
    hotel_id,
    // exclude cancelled bookings only
    status: { $nin: ["CANCELLED"] },
    $and: [
      { checkIn: { $lt: end } },
      { checkOut: { $gt: start } }
    ]
  }).select("room_id");

  const occupiedRoomIds = overlappingBookings.map(b => String(b.room_id));

  // Query rooms excluding the occupiedRoomIds
  const query = {
    hotel_id,
    _id: { $nin: occupiedRoomIds }
  };

  if (roomType) query.type = roomType;

  // NOTE: intentionally NOT filtering by current Room.status,
  // because a room may be currently OCCUPIED but available in the requested future range.
  return Room.find(query).sort({ number: 1 });
};

