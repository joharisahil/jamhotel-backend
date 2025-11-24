import express from "express";
import { createRoom, listRooms } from "../controllers/roomController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();

router.use(protect);
router.post("/", authorize("FRONT_OFFICE","GM","MD"), createRoom);
router.get("/", authorize("FRONT_OFFICE","RESTAURANT_MANAGER","GM","MD"), listRooms);

export default router;
