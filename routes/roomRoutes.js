import express from "express";
import { createRoom, listRooms, getRoom, updateRoom } from "../controllers/roomController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();

router.use(protect);
router.post("/", authorize("FRONT_OFFICE","GM","MD"), createRoom);
router.get("/", authorize("FRONT_OFFICE","RESTAURANT_MANAGER","GM","MD"), listRooms);
router.get("/:id", authorize("FRONT_OFFICE","GM","MD"), getRoom);
router.put("/:id", authorize("FRONT_OFFICE","GM","MD"), updateRoom);

export default router;
