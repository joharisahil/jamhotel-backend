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
