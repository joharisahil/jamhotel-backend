import { asyncHandler } from "../utils/asyncHandler.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import TableSession from "../models/TableSession.js";
import { autoCloseEmptySession } from "../utils/autoCloseEmptyTableSession.js";
import mongoose from "mongoose";

export const createTable = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const table = await Table.create({ hotel_id, ...req.body });

  const qrUrl = `${process.env.QR_URL}/menu/qr/table/${table._id}/${hotel_id}`;

  table.qrUrl = qrUrl;
  table.qrCodeId = `TABLE-${table._id}`;

  await table.save();

  res.json({ success: true, table });
});

export const listTables = asyncHandler(async (req, res) => {
  const tables = await Table.find({ hotel_id: req.user.hotel_id });
  res.json({ success: true, tables });
});

export const getTable = asyncHandler(async (req, res) => {
  const table = await Table.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!table)
    return res.status(404).json({ success: false, message: "Table not found" });

  res.json({ success: true, table });
});

export const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, table });
});

// Delete table
export const deleteTable = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;       // hotel of logged-in user
  const tableId = req.params.id;

  // Find table and ensure it belongs to same hotel
  const table = await Table.findOne({ _id: tableId, hotel_id });
  if (!table)
    return res.status(404).json({
      success: false,
      message: "Table not found or unauthorized",
    });

  await Table.findByIdAndDelete(tableId);

  res.json({
    success: true,
    message: "Table deleted successfully",
  });
});

export const tableOverview = async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const tables = await Table.find({ hotel_id }).lean();

  const result = [];

  for (const table of tables) {
    let orders = [];
    let total = 0;
    let sources = new Set();

    // ✅ FIX: Only count orders from ACTIVE sessions
    if (table.activeSession?.sessionId) {
      // Verify the session is actually ACTIVE
      const activeSession = await TableSession.findOne({
        _id: table.activeSession.sessionId,
        status: "ACTIVE"
      });

      if (activeSession) {
        orders = await Order.find({
          hotel_id,
          tableSession_id: activeSession._id,
          paymentStatus: "PENDING"
        });

        orders.forEach((o) => {
          total += o.total;
          sources.add(o.source);
        });
      } else {
        // ✅ FIX: Clean up stale activeSession reference
        await Table.findByIdAndUpdate(table._id, {
          status: "AVAILABLE",
          activeSession: null
        });
        table.status = "AVAILABLE";
        table.activeSession = null;
      }
    }

    result.push({
      tableId: table._id,
      name: table.name,
      status: table.status,
      ordersCount: orders.length,
      total,
      sources: Array.from(sources),
    });
  }

  res.json({ success: true, tables: result });
};

export const startTableSession = async (req, res) => {
  const { tableId } = req.params;
  const hotel_id = req.user.hotel_id;

  await autoCloseEmptySession(hotel_id, tableId);

  const table = await Table.findOne({ _id: tableId, hotel_id });
  if (!table) {
    return res.status(404).json({ success: false, message: "Table not found" });
  }

  // 🔥 ALWAYS TRUST table.activeSession
  if (table.activeSession?.sessionId) {
    const session = await TableSession.findById(table.activeSession.sessionId);

    if (session && session.status === "ACTIVE") {
      return res.json({ success: true, session, table });
    }
  }

  // 🔥 CREATE NEW SESSION (SAFE DUE TO UNIQUE INDEX)
  let session;
try {
  session = await TableSession.create({
    hotel_id,
    table_id: tableId,
  });
} catch (err) {
  // 🔥 If duplicate ACTIVE session exists, reuse it
  session = await TableSession.findOne({
    hotel_id,
    table_id: tableId,
    status: "ACTIVE",
  });
}

if (!session) {
  return res.status(500).json({
    success: false,
    message: "Failed to acquire table session"
  });
}

  table.status = "OCCUPIED";
  table.activeSession = {
    sessionId: session._id,
    startedAt: session.startedAt,
  };

  await table.save();

  res.json({ success: true, session, table });
};
