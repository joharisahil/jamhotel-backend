import express from "express";
import { createRoom, listRooms, getRoom, updateRoom, deleteRoom, getRoomTypes, getRoomsByType, getRoomPlans } from "../controllers/roomController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();

router.use(protect);
router.get("/types", authorize("FRONT_OFFICE","GM","MD"), getRoomTypes);
router.get("/list/:type", authorize("FRONT_OFFICE","GM","MD"), getRoomsByType);
router.get("/plans/:roomId", authorize("FRONT_OFFICE","GM","MD"), getRoomPlans);
router.post("/", authorize("FRONT_OFFICE","GM","MD"), createRoom);
router.get("/", authorize("FRONT_OFFICE","RESTAURANT_MANAGER","GM","MD"), listRooms);
router.get("/:id", authorize("FRONT_OFFICE","GM","MD"), getRoom);
router.put("/:id", authorize("FRONT_OFFICE","GM","MD"), updateRoom);
router.delete("/:id", authorize("FRONT_OFFICE","GM","MD"), deleteRoom);

export default router;
