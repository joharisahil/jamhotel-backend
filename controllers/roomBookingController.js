// controllers/roomBookingController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as bookingService from "../services/bookingService.js";
import * as roomService from "../services/roomService.js";
import RoomBooking from "../models/RoomBooking.js";
import RoomInvoice from "../models/RoomInvoice.js";
import Room from "../models/Room.js";
import Order from "../models/Order.js";

/**
 * CREATE BOOKING (Front Office)
 * Now supports:
 *  ✔ datetime check-in & check-out
 *  ✔ gstEnabled
 *  ✔ per-day extras
 *  ✔ returns discountAmount
 */
export const createBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const payload = req.body;

  const booking = await bookingService.createBooking({
    hotel_id,
    ...payload,
  });

  res.status(201).json({
    success: true,
    booking,
  });
});

/**
 * GET SINGLE BOOKING
 */
export const getBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  res.json({ success: true, booking });
});

/**
 * LIST BOOKINGS
 */
export const listBookings = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { status, from, to, page = 1, limit = 50 } = req.query;

  const q = { hotel_id };
  if (status) q.status = status;

  if (from || to) {
    q.checkIn = {};
    if (from) q.checkIn.$gte = new Date(from);
    if (to) q.checkIn.$lte = new Date(to);
  }

  const bookings = await RoomBooking.find(q)
    .populate("room_id")
    .sort({ checkIn: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, bookings });
});

/**
 * CHECKOUT BOOKING — uses actual checkout time
 */
export const checkoutBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await bookingService.checkoutBooking(id, req.user._id);

  res.json({ success: true, invoice });
});

/**
 * CANCEL BOOKING
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.status = "CANCELLED";
  await booking.save();

  try {
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" });
  } catch (e) { }

  res.json({ success: true, booking });
});

/**
 * CURRENT BOOKING FOR A ROOM
 */
export const getCurrentBookingForRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: req.params.roomId,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] },
  }).populate("room_id");

  res.json({ success: true, booking: booking || null });
});
export const getBookingByDate = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId, checkIn, checkOut } = req.query;

  if (!roomId || !checkIn || !checkOut)
    return res.status(400).json({ success: false, message: "Missing parameters" });

  const reqIn = new Date(checkIn);
  const reqOut = new Date(checkOut);

  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: roomId,
    status: { $nin: ["CANCELLED"] },
    checkIn: { $lt: reqOut },
    checkOut: { $gt: reqIn }
  }).populate("room_id");

  res.json({ success: true, booking: booking || null });
});


/**
 * ROOM INVOICES
 */
export const getInvoicesByRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const invoices = await RoomInvoice.find({
    hotel_id,
    room_id: req.params.roomId,
  }).sort({ createdAt: -1 });

  res.json({ success: true, invoices });
});

/**
 * CHANGE ROOM — supports transfer of pending food orders
 */
export const changeRoom = asyncHandler(async (req, res) => {
  const { id } = req.params; // booking ID
  const { newRoomId } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  const oldRoomId = booking.room_id._id;

  const newRoom = await Room.findById(newRoomId);
  if (!newRoom)
    return res.status(404).json({ success: false, message: "New room not found" });

  if (newRoom.type !== booking.room_id.type)
    return res.status(400).json({
      success: false,
      message: "Room change allowed only within same room type",
    });

  if (newRoom.status !== "AVAILABLE")
    return res.status(400).json({
      success: false,
      message: "Selected room is not available",
    });

  booking.room_id = newRoomId;
  await booking.save();

  await Room.findByIdAndUpdate(oldRoomId, { status: "AVAILABLE" });
  await Room.findByIdAndUpdate(newRoomId, { status: "OCCUPIED" });

  // Move all pending unpaid food orders
  await Order.updateMany(
    {
      room_id: oldRoomId,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
    },
    { room_id: newRoomId }
  );

  res.json({
    success: true,
    message: "Room changed successfully",
    booking,
  });
});

/**
 * EXTEND STAY
 */
export const extendStay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newCheckOut } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.checkOut = new Date(newCheckOut);
  await booking.save();

  res.json({ success: true, message: "Stay extended successfully", booking });
});
