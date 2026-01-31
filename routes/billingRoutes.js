import express from "express";
import {
  getPendingTables,
  getTableBill,
  finalizeRestaurantBill,
  getPendingRooms,
//  getRoomBill,
  finalizeRoomBill
} from "../controllers/billingController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
import { getRoomBill } from "../controllers/v2/billingController.js";

const router = express.Router();

router.use(protect);

// GM, MD, RESTAURANT_MANAGER can access
router.get("/pending", authorize("GM", "MD", "RESTAURANT_MANAGER"), getPendingTables);
router.get("/table/:tableId", authorize("GM", "MD", "RESTAURANT_MANAGER"), getTableBill);
router.post("/checkout", authorize("GM", "MD", "RESTAURANT_MANAGER"), finalizeRestaurantBill);

router.get("/pending-rooms", protect, authorize("FRONT_OFFICE","GM","MD"), getPendingRooms);
router.get("/room/:roomId", protect, authorize("FRONT_OFFICE","GM","MD"), getRoomBill);
router.post("/room/finalize", protect, authorize("FRONT_OFFICE","GM","MD"), finalizeRoomBill);

export default router;
