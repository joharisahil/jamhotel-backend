import { asyncHandler } from "../utils/asyncHandler.js";
import MaintenanceLog from "../models/MaintenanceLog.js";

/** Create complaint (public/QR) */
export const createComplaint = asyncHandler(async (req, res) => {
  const complaint = await MaintenanceLog.create({
    hotel_id: req.body.hotel_id, 
    ...req.body
  });
  res.json({ success: true, complaint });
});

/** List complaints */
export const listComplaints = asyncHandler(async (req, res) => {
  const logs = await MaintenanceLog.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, logs });
});

/** Update status */
export const updateComplaint = asyncHandler(async (req, res) => {
  const log = await MaintenanceLog.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json({ success: true, log });
});
