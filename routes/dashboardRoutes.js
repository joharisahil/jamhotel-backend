import express from "express";
import { protect, authorize } from "../utils/authMiddleware.js";
import { revenueSummary } from "../controllers/dashboardController.js";

const router = express.Router();
router.use(protect);

router.get(
  "/revenue-summary",
  protect,
  authorize("MD", "GM"),
  revenueSummary
);

export default router;
