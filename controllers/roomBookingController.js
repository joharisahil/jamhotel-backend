// controllers/roomBookingController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as bookingService from "../services/bookingService.js";
import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import { createBookingSchema } from "../validators/bookingValidator.js";
import RoomInvoice from "../models/RoomInvoice.js";

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
