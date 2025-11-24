import express from "express";
import {
  createBanquetBooking,
  listBanquetBookings
} from "../controllers/banquetBookingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/booking", authorize("BANQUET_MANAGER", "GM", "MD"), createBanquetBooking);
router.get("/booking", authorize("BANQUET_MANAGER", "GM", "MD"), listBanquetBookings);

export default router;
