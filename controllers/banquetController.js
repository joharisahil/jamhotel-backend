// controllers/banquetController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as banquetService from "../services/banquetService.js";

/**
 * Create a banquet hall
 */
export const createBanquetHall = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const hall = await banquetService.createHall(hotel_id, req.body);
  res.json({ success: true, hall });
});

/**
 * List banquet halls
 */
export const listBanquetHalls = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const halls = await banquetService.listHalls(hotel_id);
  res.json({ success: true, halls });
});

/**
 * Get single hall
 */
export const getBanquetHall = asyncHandler(async (req, res) => {
  const hall = await banquetService.getHall(req.params.id);
  if (!hall) return res.status(404).json({ success: false, message: "Hall not found" });

  // tenant validation
  if (String(hall.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  res.json({ success: true, hall });
});

/**
 * Update hall
 */
export const updateBanquetHall = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const hall = await banquetService.getHall(req.params.id);
  if (!hall) return res.status(404).json({ success: false, message: "Hall not found" });
  if (String(hall.hotel_id) !== String(hotel_id)) return res.status(403).json({ success: false, message: "Forbidden" });

  const updated = await banquetService.updateHall(req.params.id, req.body);
  res.json({ success: true, hall: updated });
});

/**
 * Delete hall
 */
export const deleteBanquetHall = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const hall = await banquetService.getHall(req.params.id);
  if (!hall) return res.status(404).json({ success: false, message: "Hall not found" });
  if (String(hall.hotel_id) !== String(hotel_id)) return res.status(403).json({ success: false, message: "Forbidden" });

  await banquetService.deleteHall(req.params.id);

  res.json({ success: true, message: "Hall deleted successfully" });
});
