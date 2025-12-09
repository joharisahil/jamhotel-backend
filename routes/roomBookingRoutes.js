// routes/roomBookingRoutes.js
import express from "express";
import {
  createBooking,
  getBooking,
  listBookings,
  getCurrentBookingForRoom,
  checkoutBooking,
  cancelBooking,
  getInvoicesByRoom
} from "../controllers/roomBookingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
import { createBookingSchema } from "../validators/bookingValidator.js";

const router = express.Router();

// Public endpoints: none (bookings created by front-desk only in this implementation)
// Protect all booking routes
router.use(protect);

// Create booking - front office, GM, MD
router.post("/", authorize("FRONT_OFFICE", "GM", "MD"), /* validate(createBookingSchema), */ createBooking);

// List bookings - front office + higher
router.get("/", authorize("FRONT_OFFICE", "GM", "MD"), listBookings);

// Get booking details
router.get("/:id", authorize("FRONT_OFFICE", "GM", "MD"), getBooking);

router.get("/current/:roomId", authorize("FRONT_OFFICE", "GM", "MD"), getCurrentBookingForRoom );

// Checkout / finalize booking
router.post("/:id/checkout", authorize("FRONT_OFFICE", "GM", "MD"), checkoutBooking);

// Cancel booking
router.post("/:id/cancel", authorize("FRONT_OFFICE", "GM", "MD"), cancelBooking);
// Get all invoices for a room
router.get("/:roomId/invoices", authorize("FRONT_OFFICE", "GM", "MD"), getInvoicesByRoom);

router.post("/:id/change-room", authorize("FRONT_OFFICE", "GM", "MD"), changeRoom);
router.post("/:id/extend-stay", authorize("FRONT_OFFICE", "GM", "MD"), extendStay);


export default router;
