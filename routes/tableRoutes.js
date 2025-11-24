import express from "express";
import {
  createTable,
  listTables,
  updateTable
} from "../controllers/tableController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("RESTAURANT_MANAGER", "GM", "MD"), createTable);
router.get("/", authorize("RESTAURANT_MANAGER", "GM", "MD"), listTables);
router.put("/:id", authorize("RESTAURANT_MANAGER", "GM", "MD"), updateTable);

export default router;
