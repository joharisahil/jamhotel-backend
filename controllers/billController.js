import Bill from "../models/Bill.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import RoomInvoice from "../models/RoomInvoice.js";
import * as transactionService from "../services/transactionService.js";
import { manualRestaurantBillSchema } from "../validators/manualRestaurantBillValidator.js";
import RoomBooking from "../models/RoomBooking.js";
import Order from "../models/Order.js";

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

  // Find room invoice
  const invoice = await RoomInvoice.findOne({ _id: billId, hotel_id })
    .populate("room_id");

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: "Room invoice not found"
    });
  }

  // Return in same format as Bill so frontend works without change
  const formatted = {
    _id: invoice._id,
    billNumber: invoice.invoiceNumber,
    source: "ROOM",
    customerName: invoice.guestName,
    customerPhone: invoice.guestPhone,
    createdAt: invoice.createdAt,
    finalAmount: invoice.totalAmount,
    room_id: invoice.room_id,
    fullInvoice: invoice   // contains stay + services + food breakdown
  };

  res.json({
    success: true,
    bill: formatted
  });
});

export const createManualRestaurantBill = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const data = manualRestaurantBillSchema.parse(req.body);

  const {
    customerName,
    customerPhone,
    tableNumber,
    items,
    subtotal,
    discount,
    gst,
    finalAmount,
    paymentMethod
  } = data;

  // generate bill number
  // Find last bill number safely
  // ----------------------
  // SAFE BILL NUMBER LOGIC
  // ----------------------
  const lastBill = await Bill.findOne({ hotel_id, source: "RESTAURANT" })
    .sort({ createdAt: -1 })
    .lean();

  let nextNumber = 1;

  if (lastBill) {
    const parsed = parseInt(lastBill.billNumber, 10);

    // If parsed is valid number, increment
    if (!isNaN(parsed)) nextNumber = parsed + 1;
  }

  // Always produce a zero-padded bill number
  const generatedBillNumber = String(nextNumber).padStart(6, "0");

  const bill = await Bill.create({
    hotel_id,
    billNumber: generatedBillNumber,
    source: "RESTAURANT",
    customerName,
    customerPhone,
    table_id: null,   // since manually entered
    referenceId: null,
    orders: [
      {
        order_id: null,
        total: finalAmount,
        items
      }
    ],
    subtotal,
    gst,
    discount,
    finalAmount,
    paymentMode: (paymentMethod || "CASH").toUpperCase(),
    createdBy: req.user._id
  });

  // also log a transaction
  await transactionService.createTransaction(hotel_id, {
    type: "CREDIT",
    source: "RESTAURANT",
    amount: finalAmount,
    description: `Restaurant Bill #${bill.billNumber}`,
    referenceId: bill._id
  });

  res.json({ success: true, bill });
});

export const transferRestaurantBillToRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { bookingId, items, subtotal, discount, gst, finalAmount } = req.body;

  const booking = await RoomBooking.findOne({
    _id: bookingId,
    hotel_id,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Active booking not found"
    });
  }

  // Convert restaurant items → Order items
  const orderItems = items.map(i => ({
    item_id: null,
    name: i.name,
    size: i.variant.toUpperCase(),
    qty: i.qty,
    unitPrice: i.price,
    totalPrice: i.total
  }));

  const order = await Order.create({
    hotel_id,
    room_id: booking.room_id,
    items: orderItems,
    subtotal,
    discount,
    gst,
    total: finalAmount,
    status: "DELIVERED",
    paymentStatus: "PENDING"
  });

  return res.json({
    success: true,
    message: "Food bill transferred to room",
    booking,
    order
  });
});
