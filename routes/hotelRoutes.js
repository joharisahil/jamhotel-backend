import express from "express";
import {
  createHotel,
  listHotels,
  getHotel,
  updateHotel,
  deleteHotel
} from "../controllers/hotelController.js";

import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

/**
 * Notes:
 * - Only MD or GM should update their hotel info
 * - Only super-admin (future SaaS) should create/list/delete hotels
 */

// Create hotel (future SaaS or initial bootstrapping)
router.post("/", createHotel);

// Protect next routes
router.use(protect);

// Get hotel details (MD, GM)
router.get("/:id", authorize("GM", "MD"), getHotel);

// Update hotel (MD, GM)
router.put("/:id", authorize("GM", "MD"), updateHotel);

// List all hotels (future SaaS admin)
router.get("/", listHotels);

// Delete hotel (future SaaS admin)
router.delete("/:id", deleteHotel);

export default router;
