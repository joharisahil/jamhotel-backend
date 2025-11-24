import { asyncHandler } from "../utils/asyncHandler.js";
import InventoryItem from "../models/InventoryItem.js";
import InventoryLog from "../models/InventoryLog.js";

/** Add item */
export const addItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.create({ hotel_id: req.user.hotel_id, ...req.body });
  res.json({ success: true, item });
});

/** List items */
export const listItems = asyncHandler(async (req, res) => {
  const items = await InventoryItem.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, items });
});

/** Add stock log */
export const addStockLog = asyncHandler(async (req, res) => {
  const log = await InventoryLog.create({
    hotel_id: req.user.hotel_id,
    ...req.body
  });
  res.json({ success: true, log });
});
