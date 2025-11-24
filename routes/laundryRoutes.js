import express from "express";
import {
  createLaundryEntry,
  listLaundry,
  updateLaundryStatus
} from "../controllers/laundryController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("LAUNDRY_MANAGER", "GM", "MD"), createLaundryEntry);
router.get("/", authorize("LAUNDRY_MANAGER", "GM", "MD"), listLaundry);
router.put("/:id", authorize("LAUNDRY_MANAGER", "GM", "MD"), updateLaundryStatus);

export default router;
