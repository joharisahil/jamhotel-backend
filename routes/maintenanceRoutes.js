import express from "express";
import {
  createComplaint,
  listComplaints,
  updateComplaint
} from "../controllers/maintenanceController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

/** Public endpoint (QR complaint) */
router.post("/", createComplaint);

/** Admin endpoints */
router.use(protect);
router.get("/", authorize("MAINTENANCE_MANAGER", "GM", "MD"), listComplaints);
router.put("/:id", authorize("MAINTENANCE_MANAGER", "GM", "MD"), updateComplaint);

export default router;
