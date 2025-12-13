// controllers/roomController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as roomService from "../services/roomService.js";
import Room from "../models/Room.js";

/**
 * CREATE ROOM
 */
export const createRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const payload = req.body;

  const room = await roomService.createRoom(hotel_id, payload);
  res.json({ success: true, room });
});

/**
 * LIST ROOMS
 */
export const listRooms = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const rooms = await roomService.listRooms(hotel_id);
  res.json({ success: true, rooms });
});

/**
 * GET ROOM
 */
export const getRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const room = await roomService.getRoomById(req.params.id, hotel_id);
  if (!room)
    return res.status(404).json({ success: false, message: "Room not found" });

  res.json({ success: true, room });
});

/**
 * UPDATE ROOM
 */
export const updateRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const updated = await roomService.updateRoomById(
    req.params.id,
    hotel_id,
    req.body
  );

  if (!updated)
    return res.status(404).json({ success: false, message: "Room not found" });

  res.json({ success: true, room: updated });
});

/**
 * DELETE ROOM
 */
export const deleteRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const deleted = await roomService.deleteRoomById(
    req.params.id,
    hotel_id
  );

  if (!deleted)
    return res.status(404).json({ success: false, message: "Room not found" });

  res.json({
    success: true,
    message: "Room deleted successfully",
  });
});

/**
 * GET ROOM TYPES
 */
export const getRoomTypes = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const types = await roomService.getRoomTypes(hotel_id);
  res.json({ success: true, types });
});

/**
 * GET ROOMS BY TYPE
 */
export const getRoomsByType = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const rooms = await roomService.getRoomsByType(
    hotel_id,
    req.params.type
  );

  res.json({ success: true, rooms });
});

/**
 * GET PLANS FOR A ROOM
 */
export const getRoomPlans = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const plans = await roomService.getRoomPlans(
    hotel_id,
    req.params.roomId
  );

  if (!plans)
    return res.status(404).json({ success: false, message: "Room not found" });

  res.json({ success: true, plans });
});

/**
 * LIST AVAILABLE ROOMS (simple filter)
 */
export const listAvailableRooms = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const rooms = await Room.find({
    hotel_id,
    status: "AVAILABLE",
    ...(req.query.type && { type: req.query.type }),
  }).sort({ number: 1 });

  res.json({ success: true, rooms });
});

/**
 * GET AVAILABLE ROOMS FOR DATETIME RANGE
 * Main endpoint used in booking flow
 */
export const getAvailableRooms = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const { checkIn, checkOut, type } = req.query;

  if (!checkIn || !checkOut)
    return res.status(400).json({
      success: false,
      message: "checkIn and checkOut datetime are required",
    });

  const rooms = await roomService.getAvailableRoomsForDates(
    hotel_id,
    checkIn,
    checkOut,
    type || null
  );

  res.json({ success: true, rooms });
});

export const getAllRoomsByDate = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { checkIn, checkOut } = req.query;

  const rooms = await roomService.getAllRoomsWithBookingStatus(hotel_id, checkIn, checkOut);

  res.json({ success: true, rooms });
});

export const getBookingByRoomForToday = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId } = req.params;

  const booking = await roomService.getActiveBookingForToday(roomId, hotel_id);

  res.json({ success: true, booking });
});
