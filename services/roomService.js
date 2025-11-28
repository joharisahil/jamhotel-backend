import Room from "../models/Room.js";
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

