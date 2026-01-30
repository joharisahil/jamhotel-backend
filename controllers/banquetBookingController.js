// controllers/banquetBookingController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as banquetService from "../services/banquetService.js";

/**
 * Create banquet booking
 */
export const createBanquetBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const booking = await banquetService.createBooking(hotel_id, req.body);
  res.status(201).json({ success: true, booking });
});

/**
 * List bookings (optionally filtered)
 */
export const listBanquetBookings = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const filters = {};

  // Booking status filter
  if (req.query.status) {
    filters.bookingStatus = req.query.status;
  }

  // Hall filter
  if (req.query.hallId) {
    filters["hall._id"] = req.query.hallId;
  }

  // 📅 Month range filter (MANDATORY FOR CALENDAR)
  if (req.query.from && req.query.to) {
    filters.eventDate = {
      $gte: new Date(req.query.from),
      $lte: new Date(req.query.to),
    };
  }

  const bookings = await banquetService.listBookings(hotel_id, filters);
  res.json({ success: true, bookings });
});

/**
 * Get single booking
 */
export const getBanquetBooking = asyncHandler(async (req, res) => {
  const booking = await banquetService.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

  // tenant check
  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  res.json({ success: true, booking });
});

/**
 * Update booking (including date range, hall change, catering)
 */
export const updateBanquetBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const updated = await banquetService.updateBooking(req.params.id, hotel_id, req.body);
  res.json({ success: true, booking: updated });
});

/**
 * Cancel booking (frees linked rooms)
 */
export const cancelBanquetBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const cancelled = await banquetService.cancelBooking(req.params.id, hotel_id);
  res.json({ success: true, booking: cancelled });
});
