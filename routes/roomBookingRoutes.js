// routes/roomBookingRoutes.js
import express from "express";
import {
  createBooking,
  getBooking,
  listBookings,
  getCurrentBookingForRoom,
  checkoutBooking,
  cancelBooking,
  getInvoicesByRoom,
  changeRoom,
  extendStay,
  getBookingByDate,
  getRoomServiceBillForBooking,
  updateFoodBilling,
  updateRoomBilling,
  getActiveRoomsToday,
  updateGuestInfo,
  updateGuestIds,
  updateCompanyDetails,
  updateBookingServices,
  reduceStay
} from "../controllers/roomBookingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

// Public endpoints: none (bookings created by front-desk only in this implementation)
// Protect all booking routes
router.use(protect);

// Create booking
router.post("/", authorize("FRONT_OFFICE", "GM", "MD"), createBooking);

// List bookings
router.get("/", authorize("FRONT_OFFICE", "GM", "MD"), listBookings);

// MUST PLACE FIXED ROUTES FIRST
router.get("/current/:roomId", authorize("FRONT_OFFICE", "GM", "MD"), getCurrentBookingForRoom);
router.get("/orders/booking/:bookingId", authorize("FRONT_OFFICE", "GM", "MD"), getRoomServiceBillForBooking);
router.get("/by-date", authorize("FRONT_OFFICE", "GM", "MD"), getBookingByDate);
router.get("/active-today", authorize("FRONT_OFFICE", "GM", "MD"), getActiveRoomsToday);

// Dynamic routes LAST
router.get("/:id", authorize("FRONT_OFFICE", "GM", "MD"), getBooking);

router.post("/:id/checkout", authorize("FRONT_OFFICE","GM","MD"), checkoutBooking);
router.post("/:id/cancel", authorize("FRONT_OFFICE","GM","MD"), cancelBooking);
router.patch("/:id/food-billing", authorize("FRONT_OFFICE","GM","MD"), updateFoodBilling);
router.patch("/:id/room-billing", authorize("FRONT_OFFICE","GM","MD"), updateRoomBilling);
router.get("/:roomId/invoices", authorize("FRONT_OFFICE","GM","MD"), getInvoicesByRoom);
router.patch("/:id/guest", authorize("FRONT_OFFICE","GM","MD"), updateGuestInfo);
router.patch("/:id/guest-ids", authorize("FRONT_OFFICE","GM","MD"), updateGuestIds);
router.patch("/:id/company", authorize("FRONT_OFFICE","GM","MD"), updateCompanyDetails);
router.patch("/:id/services", authorize("FRONT_OFFICE","GM","MD"), updateBookingServices);
router.patch("/:id/reduce-stay", authorize("FRONT_OFFICE","GM","MD"), reduceStay);
router.post("/:id/change-room", authorize("FRONT_OFFICE","GM","MD"), changeRoom);
router.post("/:id/extend-stay", authorize("FRONT_OFFICE","GM","MD"), extendStay);

export default router;
