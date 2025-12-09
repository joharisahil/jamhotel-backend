import { asyncHandler } from "../utils/asyncHandler.js";
import Room from "../models/Room.js";
import Table from "../models/Table.js";
import crypto from "crypto";

export const startQrSession = asyncHandler(async (req, res) => {
  const { source, id, hotelId } = req.body; 
  // source = "room" or "table"

  const token = crypto.randomBytes(16).toString("hex");

  let entity;
  if (source === "room") {
    entity = await Room.findOne({ _id: id, hotel_id: hotelId });
  } else {
    entity = await Table.findOne({ _id: id, hotel_id: hotelId });
  }

  if (!entity) {
    return res.status(404).json({ success: false, message: "Invalid QR" });
  }

  // Save temporary session
  entity.sessionToken = token;
  await entity.save();

  res.json({
    success: true,
    sessionToken: token
  });
});
