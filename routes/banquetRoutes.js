import express from "express";
import {
  createBanquetHall,
  listBanquetHalls,
} from "../controllers/banquetController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("BANQUET_MANAGER", "GM", "MD"), createBanquetHall);
router.get("/", authorize("BANQUET_MANAGER", "GM", "MD"), listBanquetHalls);

export default router;
