import Room from "../models/Room.js";
export const createRoom = async (hotel_id, payload) => {
  const room = await Room.create({ hotel_id, ...payload });
    // Auto-generate QR URL
  const qrUrl = `${process.env.BASE_URL}/api/menu/qr/room/${room._id}/${hotel_id}`;

  room.qrUrl = qrUrl;
  room.qrCodeId = `ROOM-${room._id}`;

  await room.save();
  
  return room;
};
export const listRooms = async (hotel_id, query = {}) => {
  return Room.find({ hotel_id, ...query });
};
export const findRoom = async (id) => Room.findById(id);
export const updateRoom = async (id, payload) => Room.findByIdAndUpdate(id, payload, { new: true });
