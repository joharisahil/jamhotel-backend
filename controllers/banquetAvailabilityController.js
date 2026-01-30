import { asyncHandler } from "../utils/asyncHandler.js";
import { getAvailableHalls } from "../services/banquetAvailabilityService.js";

/**
 * Get available halls for date & time
 * Query params:
 * ?date=YYYY-MM-DD
 * &startTime=HH:mm
 * &endTime=HH:mm
 */
export const checkHallAvailability = asyncHandler(async (req, res) => {
  const { date, startTime, endTime } = req.query;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: "date, startTime and endTime are required",
    });
  }

  const halls = await getAvailableHalls({
    hotel_id: req.user.hotel_id,
    eventDate: date,
    startTime,
    endTime,
  });

  res.json({
    success: true,
    halls,
  });
});
