import Bill from "../models/Bill.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import RoomInvoice from "../models/RoomInvoice.js";

/**
 * GET /billing
 * optional query params:
 *  - source=ROOM|RESTAURANT|BANQUET
 *  - from=2025-01-01
 *  - to=2025-01-31
 *  - search=invoiceOrPhoneOrCustomer
 *  - page, limit
 */
export const listBills = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { source, from, to, search, page = 1, limit = 50 } = req.query;

  const q = { hotel_id };

  if (source) q.source = source;

  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }

  if (search) {
    const s = String(search).trim();
    q.$or = [
      { billNumber: { $regex: s, $options: "i" } },
      { customerPhone: { $regex: s, $options: "i" } },
      { customerName: { $regex: s, $options: "i" } },
      { referenceId: { $regex: s, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [bills, total] = await Promise.all([
    Bill.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Bill.countDocuments(q),
  ]);

  res.json({ success: true, bills, total, page: Number(page), limit: Number(limit) });
});

export const getBillById = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const hotel_id = req.user.hotel_id;

  const bill = await Bill.findOne({ _id: billId, hotel_id });

  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });

  res.json({ success: true, bill });
});

export const listRoomInvoices = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { search, from, to, page = 1, limit = 50 } = req.query;

  const q = { hotel_id };

  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }

  if (search) {
    const s = String(search).trim();
    q.$or = [
      { invoiceNumber: { $regex: s, $options: "i" } },
      { guestPhone: { $regex: s, $options: "i" } },
      { guestName: { $regex: s, $options: "i" } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [invoices, total] = await Promise.all([
    RoomInvoice.find(q)
      .populate("room_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    RoomInvoice.countDocuments(q)
  ]);

  // FORMAT RESPONSE to match "Bill" model, so frontend doesn't need changes
  const formatted = invoices.map(inv => ({
    _id: inv._id,
    billNumber: inv.invoiceNumber,   // same field used in Bill
    source: "ROOM",
    customerName: inv.guestName,
    customerPhone: inv.guestPhone,
    finalAmount: inv.totalAmount,
    createdAt: inv.createdAt,
    room_id: inv.room_id
  }));

  res.json({ success: true, bills: formatted, total });
});

export const getRoomInvoiceById = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const hotel_id = req.user.hotel_id;

  const invoice = await RoomInvoice.findOne({
    _id: billId,
    hotel_id,
  }).populate("room_id");

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: "Room invoice not found",
    });
  }

  res.json({
    success: true,
    bill: {
      _id: invoice._id,
      billNumber: invoice.invoiceNumber,
      source: "ROOM",
      customerName: invoice.guestName,
      customerPhone: invoice.guestPhone,
      finalAmount: invoice.totalAmount,
      createdAt: invoice.createdAt,
      room_id: invoice.room_id,

      // Full invoice details for view page
      fullInvoice: invoice
    }
  });
});
