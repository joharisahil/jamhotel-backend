import express from "express";
import {
  createTransaction,
  listTransactions
} from "../controllers/transactionController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("GM", "MD","RESTAURANT_MANAGER"), createTransaction);
router.get("/", authorize("GM", "MD", "RESTAURANT_MANAGER"), listTransactions);

export default router;
