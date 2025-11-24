import { asyncHandler } from "../utils/asyncHandler.js";
import LaundryLog from "../models/LaundryLog.js";

export const createLaundryEntry = asyncHandler(async (req, res) => {
  const entry = await LaundryLog.create({
    hotel_id: req.user.hotel_id,
    ...req.body
  });
  res.json({ success: true, entry });
});

export const listLaundry = asyncHandler(async (req, res) => {
  const logs = await LaundryLog.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, logs });
});

export const updateLaundryStatus = asyncHandler(async (req, res) => {
  const log = await LaundryLog.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, log });
});
