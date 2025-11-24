import { asyncHandler } from "../utils/asyncHandler.js";
import SecurityLog from "../models/SecurityLog.js";

export const createSecurityLog = asyncHandler(async (req, res) => {
  const log = await SecurityLog.create({
    hotel_id: req.user.hotel_id,
    ...req.body
  });
  res.json({ success: true, log });
});

export const listSecurityLogs = asyncHandler(async (req, res) => {
  const logs = await SecurityLog.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, logs });
});
