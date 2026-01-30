import express from "express";
import {
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deletePlan,
} from "../controllers/banquetPlanController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("BANQUET_MANAGER", "GM", "MD"), createPlan);
router.get("/", authorize("BANQUET_MANAGER", "GM", "MD"), listPlans);
router.get("/:id", authorize("BANQUET_MANAGER", "GM", "MD"), getPlan);
router.put("/:id", authorize("BANQUET_MANAGER", "GM", "MD"), updatePlan);
router.delete("/:id", authorize("BANQUET_MANAGER", "GM", "MD"), deletePlan);

export default router;
