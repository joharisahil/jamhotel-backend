import express from "express";
import { updateKotItem } from "../controllers/kotController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();
router.use(protect);
router.post("/:kotId/item/:itemIndex", authorize("KITCHEN_MANAGER","GM","MD"), updateKotItem);
export default router;
