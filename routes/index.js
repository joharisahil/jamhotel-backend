import express from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import hotelRoutes from "./hotelRoutes.js";
import roomRoutes from "./roomRoutes.js";
import roomBookingRoutes from "./roomBookingRoutes.js";
import banquetRoutes from "./banquetRoutes.js";
import tableRoutes from "./tableRoutes.js";
import menuRoutes from "./menuRoutes.js";
import orderRoutes from "./orderRoutes.js";
import kotRoutes from "./kotRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import maintenanceRoutes from "./maintenanceRoutes.js";
import laundryRoutes from "./laundryRoutes.js";
import securityRoutes from "./securityRoutes.js";
import transactionRoutes from "./transactionRoutes.js";
import banquetBookingRoutes from "./banquetBookingRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/hotels", hotelRoutes);
router.use("/rooms", roomRoutes);
router.use("/room-bookings", roomBookingRoutes);
router.use("/banquet-bookings", banquetBookingRoutes);
router.use("/banquets", banquetRoutes);
router.use("/tables", tableRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", orderRoutes);
router.use("/kot", kotRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/laundry", laundryRoutes);
router.use("/security", securityRoutes);
router.use("/transactions", transactionRoutes);

export default router;
