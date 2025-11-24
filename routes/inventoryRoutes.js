import express from "express";
import {
  addItem,
  listItems,
  addStockLog
} from "../controllers/inventoryController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("STORE_MANAGER", "GM", "MD"), addItem);
router.get("/", authorize("STORE_MANAGER", "GM", "MD"), listItems);

router.post("/logs", authorize("STORE_MANAGER", "GM", "MD"), addStockLog);

export default router;
