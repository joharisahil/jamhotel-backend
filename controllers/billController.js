import Bill from "../models/Bill.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import RoomInvoice from "../models/RoomInvoice.js";
import * as transactionService from "../services/transactionService.js";
import { manualRestaurantBillSchema } from "../validators/manualRestaurantBillValidator.js";
import RoomBooking from "../models/RoomBooking.js";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import Table from "../models/Table.js";
import TableSession from "../models/TableSession.js";
import Hotel from "../models/Hotel.js";

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
  const {
    source,
    from,
    to,
    search,
    page = 1,
    limit = 20
  } = req.query;

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
      { customerName: { $regex: s, $options: "i" } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [rawBills, total] = await Promise.all([
    Bill.find(q)
      .populate("table_id", "name")
      .populate("room_id", "number")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Bill.countDocuments(q)
  ]);

  // 🔁 Normalize for frontend
  const bills = rawBills.map(b => ({
    _id: b._id,
    billNumber: b.billNumber,
    source: b.source,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    finalAmount: b.finalAmount,
    createdAt: b.createdAt,

    table: b.table_id
      ? { _id: b.table_id._id, name: b.table_id.name }
      : null,

    room: b.room_id
      ? { _id: b.room_id._id, number: b.room_id.number }
      : null,

    banquet: null // future-ready
  }));

  res.json({
    success: true,
    bills,
    total,
    page: Number(page),
    limit: Number(limit)
  });
});

export const getBillById = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const hotel_id = req.user.hotel_id;

  const bill = await Bill.findOne({ _id: billId, hotel_id });

  const hotel = await Hotel.findById(hotel_id)
  .select("name address phone gstNumber");

  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });

  res.json({ success: true, bill, hotel });
});

export const listRoomInvoices = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { search, from, to, page = 1, limit = 20 } = req.query;

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
      .populate("room_id", "number")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    RoomInvoice.countDocuments(q)
  ]);

  const bills = invoices.map(inv => ({
    _id: inv._id,
    billNumber: inv.invoiceNumber,
    source: "ROOM",
    customerName: inv.guestName,
    customerPhone: inv.guestPhone,
    finalAmount: inv.totalAmount,
    createdAt: inv.createdAt,

    table: null,

    room: inv.room_id
      ? {
          _id: inv.room_id._id,
          number: inv.room_id.number
        }
      : null,

    banquet: null
  }));

  res.json({
    success: true,
    bills,
    total,
    page: Number(page),
    limit: Number(limit)
  });
});

export const getRoomInvoiceById = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const hotel_id = req.user.hotel_id;

  const invoice = await RoomInvoice.findOne({
    _id: billId,
    hotel_id
  })
    .populate("room_id", "number type")
    .lean();

  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: "Room invoice not found"
    });
  }

  const booking = await RoomBooking.findById(invoice.bookingId)
    .select("checkIn advancePaymentMode")
    .lean();

  const hotel = await Hotel.findById(invoice.hotel_id)
    .select("name address phone gstNumber")
    .lean();

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

      room: invoice.room_id
        ? { _id: invoice.room_id._id, number: invoice.room_id.number }
        : null,

      hotel,
      fullInvoice: invoice,
      bookingInfo: booking
    }
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

  // ------------------------------
  // ATOMIC BILL NUMBER GENERATION
  // ------------------------------
  const counter = await Counter.findOneAndUpdate(
    { hotel_id, key: "RESTAURANT_BILL" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const billNumber = String(counter.seq).padStart(6, "0");

  const bill = await Bill.create({
    hotel_id,
    billNumber,
    source: "RESTAURANT",
    customerName,
    customerPhone,
    table_id: null,
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
  if (booking.status === "CHECKEDOUT") {
  throw new Error("Cannot add food to checked-out booking");
}

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Active booking not found"
    });
  }

  // Convert restaurant items → Order items
  const orderItems = items.map(i => ({
    item_id: i.item_id || null,
    name: i.name,
    size: (i.size || i.variant || "FULL").toUpperCase(),
    qty: i.qty,
    unitPrice: i.price,
    totalPrice: i.total
  }));

  const order = await Order.create({
    hotel_id,
    room_id: booking.room_id,
    booking_id: booking._id,
    source: "RESTAURANT_TRANSFER",
    items: orderItems,
    subtotal,
    discount,
    gst,
    total: finalAmount,
    status: "DELIVERED",
    paymentStatus: "PENDING"
  });

  // Close table session if transferred from table
if (req.body.tableId) {
  const table = await Table.findOne({ _id: req.body.tableId, hotel_id });
  if (table?.activeSession?.sessionId) {
    await TableSession.findByIdAndUpdate(
      table.activeSession.sessionId,
      { status: "CLOSED", closedAt: new Date() }
    );

    table.status = "AVAILABLE";
    table.activeSession = null;
    table.sessionToken = null;
    table.sessionExpiresAt = null;
    await table.save();
  }
}

  return res.json({
    success: true,
    message: "Food bill transferred to room",
    booking,
    order
  });
});

export const checkoutTable = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { tableId } = req.params;

  const {
    discount = 0,
    payments = [],
    customerName,
    customerPhone,
    customerCompanyName,
    customerCompanyGSTIN,
    items: frontendItems,
    subtotal: frontendSubtotal,
    gst: frontendGst,
    finalAmount: frontendFinalAmount
  } = req.body;

  const table = await Table.findOne({ _id: tableId, hotel_id });
  if (!table?.activeSession?.sessionId) {
    return res.status(400).json({
      success: false,
      message: "No active table session"
    });
  }

  const session = await TableSession.findById(table.activeSession.sessionId);

  let items = [];
  let subtotal = 0;
  let gst = 0;
  let finalAmount = 0;

  if (Array.isArray(frontendItems) && frontendItems.length > 0) {
    items = frontendItems.map(i => ({
      item_id: i.item_id || null,
      order_id: i.order_id || null,
      name: i.name,
      size: i.size,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      totalPrice: i.total
    }));

    subtotal = frontendSubtotal;
    gst = frontendGst;
    finalAmount = frontendFinalAmount;
  } else {
    const orders = await Order.find({
      tableSession_id: session._id
    });

    if (!orders.length) {
      return res.status(400).json({
        success: false,
        message: "No orders in this session"
      });
    }

    items = orders.flatMap(o => o.items);
    subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
    gst = +(subtotal * 0.05).toFixed(2);
    finalAmount = subtotal + gst - discount;
  }

  const counter = await Counter.findOneAndUpdate(
    { hotel_id, key: "RESTAURANT_BILL" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const billNumber = String(counter.seq).padStart(6, "0");

  if (!payments.length) {
  return res.status(400).json({
    success: false,
    message: "Payment details required"
  });
}

const paidAmount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

if (+paidAmount.toFixed(2) !== +finalAmount.toFixed(2)) {
  return res.status(400).json({
    success: false,
    message: "Payment split does not match final amount"
  });
}

const billData = {
  hotel_id,
  billNumber,
  source: "RESTAURANT",
  table_id: table._id,
  customerName: customerName || "",
  customerPhone: customerPhone || "",
  customerCompanyName: customerCompanyName || "",
  customerCompanyGSTIN: customerCompanyGSTIN || "",
  subtotal,
  gst,
  discount,
  finalAmount,
  payments,
  orders: [
    {
      order_id: items[0]?.order_id || null,
      total: finalAmount,
      items
    }
  ],
  createdBy: req.user._id
};

if (payments.length === 1) {
  billData.paymentMode = payments[0].mode;
}

const bill = await Bill.create(billData);

await Order.updateMany(
  {
    tableSession_id: session._id,
    paymentStatus: "PENDING"
  },
  {
    paymentStatus: "PAID",
    paidAt: new Date(),
    billNumber: bill.billNumber
  }
);

  for (const p of payments) {
  await transactionService.createTransaction(hotel_id, {
    type: "CREDIT",
    source: "RESTAURANT",
    amount: p.amount,
    paymentMode: p.mode,
    referenceId: bill._id,
    description: `Restaurant Bill #${billNumber} (${p.mode})`
  });
}

  session.status = "CLOSED";
  session.closedAt = new Date();
  session.customerName = customerName;
  session.customerPhone = customerPhone;
  await session.save();

  table.status = "AVAILABLE";
  table.activeSession = null;
  table.sessionToken = null;
  table.sessionExpiresAt = null;
  await table.save();

  const hotel = await Hotel.findById(hotel_id).select(
    "name address phone gstNumber"
  );

  res.json({ success: true, bill, hotel });
});
