import express from "express";
import { listBills, getBillById, listRoomInvoices } from "../controllers/billController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/room", authorize("GM", "MD", "RESTAURANT_MANAGER"), listRoomInvoices);
router.get("/", authorize("GM", "MD", "RESTAURANT_MANAGER"), listBills);
router.get("/:billId", authorize("GM", "MD", "RESTAURANT_MANAGER"), getBillById);

export default router;
