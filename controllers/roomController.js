import { asyncHandler } from "../utils/asyncHandler.js";
import * as roomService from "../services/roomService.js";
import { createRoomSchema } from "../validators/roomValidator.js";

export const createRoom = asyncHandler(async (req,res) => {
  const payload = createRoomSchema.parse(req.body);
  const hotel_id = req.user.hotel_id;
  const room = await roomService.createRoom(hotel_id, payload);
  res.json({ success:true, room });
});

export const listRooms = asyncHandler(async (req,res) => {
  const hotel_id = req.user.hotel_id;
  const rooms = await roomService.listRooms(hotel_id);
  res.json({ success:true, rooms });
});

export const getRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.id;
  const hotel_id = req.user.hotel_id;

  const room = await roomService.getRoomById(roomId, hotel_id);

  if (!room) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }

  res.json({ success: true, room });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.id;
  const hotel_id = req.user.hotel_id;

  const payload = req.body; // if needed, validate with zod

  const updatedRoom = await roomService.updateRoomById(roomId, hotel_id, payload);

  if (!updatedRoom) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }

  res.json({ success: true, room: updatedRoom });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const roomId = req.params.id;
  const hotel_id = req.user.hotel_id;

  const deletedRoom = await roomService.deleteRoomById(roomId, hotel_id);

  if (!deletedRoom) {
    return res.status(404).json({ success: false, message: "Room not found" });
  }

  res.json({ success: true, message: "Room deleted successfully" });
});


