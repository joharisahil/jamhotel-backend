import { asyncHandler } from "../utils/asyncHandler.js";
import * as hotelService from "../services/hotelService.js";
import { createHotelSchema, updateHotelSchema } from "../validators/hotelValidator.js";

/**
 * Create hotel (Only MD during setup OR super-admin in future SaaS)
 */
export const createHotel = asyncHandler(async (req, res) => {
  const data = createHotelSchema.parse(req.body);

  const hotel = await hotelService.createHotel(data);

  res.json({
    success: true,
    message: "Hotel created successfully",
    hotel,
  });
});

/**
 * List all hotels (For SaaS admin only)
 */
export const listHotels = asyncHandler(async (req, res) => {
  const hotels = await hotelService.listHotels();
  res.json({ success: true, hotels });
});

/**
 * Get single hotel
 */
export const getHotel = asyncHandler(async (req, res) => {
  const hotel = await hotelService.getHotel(req.params.id);
  if (!hotel)
    return res.status(404).json({ success: false, message: "Hotel not found" });

  res.json({ success: true, hotel });
});

/**
 * Update hotel details (MD/GM)
 */
export const updateHotel = asyncHandler(async (req, res) => {
  const data = updateHotelSchema.parse(req.body);

  const updated = await hotelService.updateHotel(req.params.id, data);

  if (!updated)
    return res.status(404).json({ success: false, message: "Hotel not found" });

  res.json({
    success: true,
    message: "Hotel updated successfully",
    hotel: updated,
  });
});

/**
 * Delete hotel (super-admin only)
 */
export const deleteHotel = asyncHandler(async (req, res) => {
  const deleted = await hotelService.deleteHotel(req.params.id);

  if (!deleted)
    return res.status(404).json({ success: false, message: "Hotel not found" });

  res.json({
    success: true,
    message: "Hotel deleted successfully",
  });
});
