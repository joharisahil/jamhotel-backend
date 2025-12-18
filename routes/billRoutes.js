import express from "express";
import { listBills, getBillById, getRoomInvoiceById, listRoomInvoices, createManualRestaurantBill, transferRestaurantBillToRoom, checkoutTable } from "../controllers/billController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/room", authorize("GM","MD","RESTAURANT_MANAGER"), listRoomInvoices);
router.get("/room/:billId", authorize("GM","MD","RESTAURANT_MANAGER"), getRoomInvoiceById);
router.get("/", authorize("GM","MD","RESTAURANT_MANAGER"), listBills);
router.get("/:billId", authorize("GM","MD","RESTAURANT_MANAGER"), getBillById);
router.post("/restaurant/manual", protect, authorize("RESTAURANT_MANAGER","GM","MD"), createManualRestaurantBill);
router.post("/restaurant/transfer", authorize("RESTAURANT_MANAGER","GM","MD"), transferRestaurantBillToRoom );
router.post("/tables/:tableId/checkout", protect, authorize("RESTAURANT_MANAGER","GM","MD"), checkoutTable);

export default router;
