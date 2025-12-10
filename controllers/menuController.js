import { asyncHandler } from "../utils/asyncHandler.js";
import * as menuService from "../services/menuService.js";
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
} from "../validators/menuValidator.js";
import Table from "../models/Table.js";
import Room from "../models/Room.js"

/**
 * CATEGORY CONTROLLERS
 */
export const createCategory = asyncHandler(async (req, res) => {
  const data = createCategorySchema.parse(req.body);
  const category = await menuService.createCategory(req.user.hotel_id, data);
  res.json({ success: true, category });
});

export const listCategories = asyncHandler(async (req, res) => {
  const categories = await menuService.listCategories(req.user.hotel_id);
  res.json({ success: true, categories });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = updateCategorySchema.parse(req.body);
  const updated = await menuService.updateCategory(
    req.user.hotel_id,
    req.params.id,
    data
  );
  res.json({ success: true, category: updated });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await menuService.deleteCategory(req.user.hotel_id, req.params.id);
  res.json({ success: true, message: "Deleted" });
});

/**
 * MENU ITEM CONTROLLERS
 */
export const createMenuItem = asyncHandler(async (req, res) => {
  const data = createMenuItemSchema.parse(req.body);
  const item = await menuService.createMenuItem(req.user.hotel_id, data);
  res.json({ success: true, item });
});

export const listMenuItems = asyncHandler(async (req, res) => {
  const items = await menuService.listMenuItems(
    req.user.hotel_id,
    req.query.category_id
  );
  res.json({ success: true, items });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const data = updateMenuItemSchema.parse(req.body);
  const item = await menuService.updateMenuItem(
    req.user.hotel_id,
    req.params.id,
    data
  );
  res.json({ success: true, item });
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  await menuService.deleteMenuItem(req.user.hotel_id, req.params.id);
  res.json({ success: true, message: "Item deleted" });
});

/**
 * PUBLIC MENU FOR QR (ROOM + TABLE)
 */
export const publicMenu = asyncHandler(async (req, res) => {
  const hotel_id = req.params.hotelId;
  const { source, id } = req.params;

  const menu = await menuService.getFullMenu(hotel_id);

  let meta = null;

  if (source === "table") {
    meta = await Table.findById(id).select("name number sessionToken");
  }

  if (source === "room") {
    meta = await Room.findById(id).select("name number sessionToken");
  }

  // 🚨 NEW ADDITION
if (!meta) {
  return res.json({
    success: false,
    message: "Invalid QR",
  });
}


  res.json({
    success: true,
    source,
    id,
    meta,        // 👈 ADDED
    menu
  });
});