import express from "express";
import {
  createTable,
  listTables,
  updateTable,
  getTable,
  deleteTable,
  tableOverview,
  startTableSession
} from "../controllers/tableController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("RESTAURANT_MANAGER", "GM", "MD"), createTable);
router.get("/", authorize("RESTAURANT_MANAGER", "GM", "MD"), listTables);
router.get("/overview", authorize("RESTAURANT_MANAGER", "GM", "MD"), tableOverview);
router.get("/:id", authorize("RESTAURANT_MANAGER", "GM", "MD"), getTable);
router.put("/:id", authorize("RESTAURANT_MANAGER", "GM", "MD"), updateTable);
router.delete("/:id", authorize("RESTAURANT_MANAGER", "GM", "MD"), deleteTable);
router.post("/:tableId/start-session", authorize("RESTAURANT_MANAGER", "GM", "MD"), startTableSession);

export default router;
