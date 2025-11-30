import express from "express";
import {
  getPendingTables,
  getTableBill,
  finalizeRestaurantBill
} from "../controllers/billingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

router.use(protect);

// GM, MD, RESTAURANT_MANAGER can access
router.get("/pending", authorize("GM", "MD", "RESTAURANT_MANAGER"), getPendingTables);
router.get("/table/:tableId", authorize("GM", "MD", "RESTAURANT_MANAGER"), getTableBill);
router.post("/checkout", authorize("GM", "MD", "RESTAURANT_MANAGER"), finalizeRestaurantBill);

export default router;
