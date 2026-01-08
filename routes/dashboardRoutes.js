import express from "express";
import { protect, authorize } from "../utils/authMiddleware.js";
import { revenueSummary } from "../controllers/dashboardController.js";
import { downloadSummary } from "../controllers/dashboardDownloadController.js";

const router = express.Router();
router.use(protect);

router.get(
  "/revenue-summary",
  protect,
  authorize("MD", "GM"),
  revenueSummary
);
router.get(
  "/download-summary",
  protect,
  authorize("MD","GM"),
  downloadSummary
);

export default router;
