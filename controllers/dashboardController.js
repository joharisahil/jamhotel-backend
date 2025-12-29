import { asyncHandler } from "../utils/asyncHandler.js";
import { getRevenueSummary } from "../services/dashboardService.js";

export const revenueSummary = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const range = (req.query.range || "TODAY").toUpperCase();

  const data = await getRevenueSummary(hotel_id, range);

  res.json({
    success: true,
    range,
    room: data.room,
    restaurant: data.restaurant,
    total: data.room.total + data.restaurant.total,
  });
});
