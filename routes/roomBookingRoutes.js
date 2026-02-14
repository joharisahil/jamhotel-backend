// routes/roomBookingRoutes.js
import express from "express";
import {
  createBooking,
  // getBooking,
  listBookings,
  getCurrentBookingForRoom,
  checkoutBooking,
  cancelBooking,
  getInvoicesByRoom,
  changeRoom,
  extendStay,
  getBookingByDate,
  getRoomServiceBillForBooking,
  // updateFoodBilling,
  //updateRoomBilling,
  getActiveRoomsToday,
  updateGuestInfo,
  updateGuestIds,
  updateCompanyDetails,
  //updateBookingServices,
  reduceStay,
} from "../controllers/roomBookingController.js";

//v2
import {
  addAdvancePayment,
  updateAdvancePayment,
  removeAdvancePayment,
  //updateGuestInfo,
  resolveBooking,
  updateRoomBilling,
  getBooking,
  updateBookingServices,
  updateFoodBilling,
  getFoodBillingSummaryForBooking,
  blockRoom,
  blockSelectedRooms,
  convertBlockToBooking,
  unblockRoom
} from "../controllers/v2/roomBookingController.js";
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
router.get(
  "/current/:roomId",
  authorize("FRONT_OFFICE", "GM", "MD"),
  getCurrentBookingForRoom,
);
// router.get("/orders/booking/:bookingId", authorize("FRONT_OFFICE", "GM", "MD"), getRoomServiceBillForBooking);
router.get("/by-date", authorize("FRONT_OFFICE", "GM", "MD"), getBookingByDate);
router.get(
  "/active-today",
  authorize("FRONT_OFFICE", "GM", "MD"),
  getActiveRoomsToday,
);

// Dynamic routes LAST
// router.get("/:id", authorize("FRONT_OFFICE", "GM", "MD"), getBooking);

router.post(
  "/:id/checkout",
  authorize("FRONT_OFFICE", "GM", "MD"),
  checkoutBooking,
);
router.post(
  "/:id/cancel",
  authorize("FRONT_OFFICE", "GM", "MD"),
  cancelBooking,
);
//router.patch("/:id/food-billing", authorize("FRONT_OFFICE","GM","MD"), updateFoodBilling);
//router.patch("/:id/room-billing", authorize("FRONT_OFFICE","GM","MD"), updateRoomBilling);

router.get(
  "/:roomId/invoices",
  authorize("FRONT_OFFICE", "GM", "MD"),
  getInvoicesByRoom,
);
router.patch(
  "/:id/guest",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateGuestInfo,
); //for updating the edit
router.patch(
  "/:id/guest-ids",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateGuestIds,
);
router.patch(
  "/:id/company",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateCompanyDetails,
);
//router.patch("/:id/services", authorize("FRONT_OFFICE","GM","MD"), updateBookingServices);

router.patch(
  "/:id/reduce-stay",
  authorize("FRONT_OFFICE", "GM", "MD"),
  reduceStay,
);
router.post(
  "/:id/change-room",
  authorize("FRONT_OFFICE", "GM", "MD"),
  changeRoom,
);
router.post(
  "/:id/extend-stay",
  authorize("FRONT_OFFICE", "GM", "MD"),
  extendStay,
);

//v2
router.patch(
  "/:id/room-billing",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateRoomBilling,
);
router.post(
  "/:id/advances",
  authorize("FRONT_OFFICE", "GM", "MD"),
  addAdvancePayment,
);

router.patch(
  "/:id/advances/:advanceId",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateAdvancePayment,
);

router.delete(
  "/:id/advances/:advanceId",
  authorize("FRONT_OFFICE", "GM", "MD"),
  removeAdvancePayment,
);

router.patch(
  "/:id/food-billing",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateFoodBilling,
);

router.get(
  "/orders/booking/:bookingId",
  authorize("FRONT_OFFICE", "GM", "MD"),
  getFoodBillingSummaryForBooking,
);

router.get("/:id", authorize("FRONT_OFFICE", "GM", "MD"), getBooking);

router.patch(
  "/:id/services",
  authorize("FRONT_OFFICE", "GM", "MD"),
  updateBookingServices,
);

// Booking by ID
router.get("/resolve/:bookingId", protect, resolveBooking);

// Room-based resolution (today or date)
router.get("/resolve/room/:roomId", protect, resolveBooking);

router.post(
  "/block",
  protect,
  authorize("FRONT_OFFICE", "GM", "MD"),
  blockRoom,
);

router.post(
  "/block-selected",
  authorize("FRONT_OFFICE", "GM", "MD"),
  blockSelectedRooms,
);

router.patch(
  "/:id/convert",
  authorize("FRONT_OFFICE", "GM", "MD"),
  convertBlockToBooking
);
router.patch(
  "/unblock/:id",
  authorize("FRONT_OFFICE", "GM", "MD"),
  unblockRoom
);



export default router;
