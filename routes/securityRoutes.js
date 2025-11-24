import express from "express";
import {
  createSecurityLog,
  listSecurityLogs
} from "../controllers/securityController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/", authorize("SECURITY", "GM", "MD"), createSecurityLog);
router.get("/", authorize("SECURITY", "GM", "MD"), listSecurityLogs);

export default router;
