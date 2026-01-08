import { asyncHandler } from "../utils/asyncHandler.js";
import { getDownloadSummary } from "../services/dashboardDownloadService.js";

export const downloadSummary = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const range = (req.query.range || "TODAY").toUpperCase();
  const type = (req.query.type || "ALL").toUpperCase();

  const data = await getDownloadSummary(hotel_id, range, type);

  res.json({
    success: true,
    range,
    type,
    rows: data,
  });
});
