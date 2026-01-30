import express from "express";
import {
  createBanquetBooking,
  listBanquetBookings,
  getBanquetBooking,
  updateBanquetBooking,
  cancelBanquetBooking
} from "../controllers/banquetBookingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
import { checkHallAvailability } from "../controllers/banquetAvailabilityController.js";

const router = express.Router();
router.use(protect);

router.post("/booking", authorize("BANQUET_MANAGER", "GM", "MD"), createBanquetBooking);
router.get("/booking", authorize("BANQUET_MANAGER", "GM", "MD"), listBanquetBookings);
router.get("/available-halls", authorize("BANQUET_MANAGER", "GM", "MD"), checkHallAvailability);
router.get("/booking/:id", authorize("BANQUET_MANAGER", "GM", "MD"), getBanquetBooking);
router.put("/booking/:id", authorize("BANQUET_MANAGER", "GM", "MD"), updateBanquetBooking);
router.delete("/booking/:id", authorize("BANQUET_MANAGER", "GM", "MD"), cancelBanquetBooking);

export default router;
