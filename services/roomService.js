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
