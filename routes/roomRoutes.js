import express from "express";
import { createRoom, listRooms, getRoom, updateRoom, deleteRoom, getRoomTypes, getRoomsByType, getRoomPlans, listAvailableRooms, getAvailableRooms, getAllRoomsByDate } from "../controllers/roomController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
const router = express.Router();

router.use(protect);
router.get("/types", authorize("FRONT_OFFICE", "GM", "MD"), getRoomTypes);
router.get("/list/:type", authorize("FRONT_OFFICE", "GM", "MD"), getRoomsByType);
router.get("/plans/:roomId", authorize("FRONT_OFFICE", "GM", "MD"), getRoomPlans);
router.post("/", authorize("FRONT_OFFICE", "GM", "MD"), createRoom);
router.get("/", authorize("FRONT_OFFICE", "RESTAURANT_MANAGER", "GM", "MD"), listRooms);
router.get("/available", protect, authorize("FRONT_OFFICE", "GM", "MD"), listAvailableRooms);
router.get("/date/available", authorize("FRONT_OFFICE", "GM", "MD"), getAvailableRooms);
router.get("/:id", authorize("FRONT_OFFICE", "GM", "MD"), getRoom);
router.put("/:id", authorize("FRONT_OFFICE", "GM", "MD"), updateRoom);
router.delete("/:id", authorize("FRONT_OFFICE", "GM", "MD"), deleteRoom);
router.get("/date/all", authorize("FRONT_OFFICE", "GM", "MD"), getAllRoomsByDate);

export default router;
