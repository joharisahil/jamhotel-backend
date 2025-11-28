import express from "express";
import { createOrder, updateOrderStatus, getLiveOrders } from "../controllers/orderController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();

router.post("/", createOrder); // public QR orders allowed
router.use(protect);
router.get("/live/:hotelId", protect, authorize("KITCHEN_MANAGER","RESTAURANT_MANAGER","GM","MD"), getLiveOrders);
router.post("/:orderId/status", authorize("KITCHEN_MANAGER","RESTAURANT_MANAGER","GM","MD"), updateOrderStatus);

export default router;
