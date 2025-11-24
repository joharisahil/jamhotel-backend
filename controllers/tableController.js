import { asyncHandler } from "../utils/asyncHandler.js";
import Table from "../models/Table.js";

export const createTable = asyncHandler(async (req, res) => {
  const table = await Table.create({ hotel_id: req.user.hotel_id, ...req.body });
   const qrUrl = `${process.env.BASE_URL}/api/menu/qr/table/${table._id}/${hotel_id}`;

  table.qrUrl = qrUrl;
  table.qrCodeId = `TABLE-${table._id}`;

  await table.save();

  res.json({ success: true, table });
});

export const listTables = asyncHandler(async (req, res) => {
  const tables = await Table.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, tables });
});

export const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, table });
});
