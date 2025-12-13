// routes/menuRoutes.js
import express from "express";
import {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  createMenuItem,
  listMenuItems,
  updateMenuItem,
  deleteMenuItem,
  publicMenu,
  searchMenuItems
} from "../controllers/menuController.js";
import { startQrSession } from "../controllers/qrController.js";

import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

/**
 * PUBLIC QR MENU (NO AUTH)
 * room:  /api/menu/qr/room/:roomId/:hotelId
 * table: /api/menu/qr/table/:tableId/:hotelId
 */
router.get("/qr/:source(room|table)/:id/:hotelId", publicMenu);
router.post("/qr/session/start", startQrSession);
/**
 * ADMIN ROUTES (MD / GM / RESTAURANT_MANAGER)
 */
router.use(protect);
router.use(authorize("GM", "MD", "RESTAURANT_MANAGER"));

router.post("/category", createCategory);
router.get("/category", listCategories);
router.put("/category/:id", updateCategory);
router.delete("/category/:id", deleteCategory);

router.post("/item", createMenuItem);
router.get("/item", listMenuItems);
router.put("/item/:id", updateMenuItem);
router.delete("/item/:id", deleteMenuItem);
router.get("/search", searchMenuItems);

export default router;
