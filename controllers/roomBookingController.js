// controllers/roomBookingController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as bookingService from "../services/bookingService.js";
import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import { createBookingSchema } from "../validators/bookingValidator.js";
import RoomInvoice from "../models/RoomInvoice.js";
import Order from "../models/Order.js";

/**
 * Create a new room booking (Front Office)
 * Body validated by createBookingSchema
 */
export const createBooking = asyncHandler(async (req, res) => {
  // parse/validate input
  const payload = createBookingSchema.parse(req.body);

  // ensure hotel_id comes from authenticated user (tenant-safe)
  const hotel_id = req.user.hotel_id;

  // call service
  const booking = await bookingService.createBooking({ hotel_id, ...payload });

  res.status(201).json({ success: true, booking });
});

/**
 * Get single booking
 */
export const getBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  // tenant check
  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  res.json({ success: true, booking });
});

/**
 * List bookings (with optional filters)
 */
export const listBookings = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { status, from, to, page = 1, limit = 50 } = req.query;
  const q = { hotel_id };
  if (status) q.status = status;
  if (from || to) q.checkIn = {};
  if (from) q.checkIn.$gte = new Date(from);
  if (to) q.checkIn.$lte = new Date(to);

  const bookings = await RoomBooking.find(q)
    .populate("room_id")
    .sort({ checkIn: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, bookings });
});

/**
 * Checkout booking (finalize & free the room)
 */
export const checkoutBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await bookingService.checkoutBooking(id, req.user._id);
  res.json({ success: true, invoice });
});

/**
 * Cancel booking
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await RoomBooking.findById(id);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  booking.status = "CANCELLED";
  await booking.save();

  // free the room if currently booked
  try {
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" });
  } catch (e) {
    // non-fatal
    console.warn("Failed to update room status on cancel:", e.message);
  }

  res.json({ success: true, booking });
});

export const getCurrentBookingForRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId } = req.params;

  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: roomId,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] }
  }).populate("room_id");

  if (!booking) {
    return res.json({ success: true, booking: null });
  }

  res.json({ success: true, booking });
});

export const getInvoicesByRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId } = req.params;

  const invoices = await RoomInvoice.find({
    hotel_id,
    room_id: roomId
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    invoices
  });
});

/**
 * Change Room
 */
export const changeRoom = asyncHandler(async (req, res) => {
  const { id } = req.params; // booking ID
  const { newRoomId } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  // Permission check
  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const oldRoomId = booking.room_id._id;

  // Load new room
  const newRoom = await Room.findById(newRoomId);
  if (!newRoom)
    return res.status(404).json({ success: false, message: "New room not found" });

  // 🔥 Ensure new room is same type
  if (newRoom.type !== booking.room_id.type) {
    return res.status(400).json({
      success: false,
      message: "Room change allowed only to same room type"
    });
  }

  // 🔥 Ensure new room is available
  if (newRoom.status !== "AVAILABLE") {
    return res.status(400).json({
      success: false,
      message: "Selected room is not available"
    });
  }

  // Update booking
  booking.room_id = newRoomId;
  await booking.save();

  // Free old room
  await Room.findByIdAndUpdate(oldRoomId, { status: "AVAILABLE" });

  // Occupy new room
  await Room.findByIdAndUpdate(newRoomId, { status: "OCCUPIED" });

  // 👉 Transfer all PENDING food orders to new room
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
 * Extend Stay
 */
export const extendStay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newCheckOut } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  booking.checkOut = new Date(newCheckOut);
  await booking.save();

  res.json({
    success: true,
    message: "Stay extended successfully",
    booking
  });
});
