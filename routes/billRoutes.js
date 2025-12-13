import express from "express";
import { listBills, getBillById, getRoomInvoiceById, listRoomInvoices, createManualRestaurantBill } from "../controllers/billController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/room", authorize("GM","MD","RESTAURANT_MANAGER"), listRoomInvoices);
router.get("/room/:billId", authorize("GM","MD","RESTAURANT_MANAGER"), getRoomInvoiceById);
router.get("/", authorize("GM","MD","RESTAURANT_MANAGER"), listBills);
router.get("/:billId", authorize("GM","MD","RESTAURANT_MANAGER"), getBillById);
router.post("/restaurant/manual", protect, authorize("RESTAURANT_MANAGER","GM","MD","OWNER"), createManualRestaurantBill);

export default router;
