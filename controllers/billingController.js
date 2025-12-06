import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Table from "../models/Table.js";
import Bill from "../models/Bill.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js"; 

export const getPendingTables = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  // FIX: import Table model above
  const tables = await Table.find({ hotel_id });

  const result = [];

  for (const table of tables) {
    const orders = await Order.find({
      hotel_id,
      table_id: table._id,
      status: "DELIVERED",
      paymentStatus: "PENDING"
    });

    if (orders.length === 0) continue;

    const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const gst = orders.reduce((sum, o) => sum + o.gst, 0);
    const total = orders.reduce((sum, o) => sum + o.total, 0);

    result.push({
      tableId: table._id,
      name: table.name,
      orders,
      summary: { subtotal, gst, total }
    });
  }

  res.json({ success: true, tables: result });
});


export const getTableBill = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const hotel_id = req.user.hotel_id;

  const orders = await Order.find({
    hotel_id,
    table_id: tableId,
    status: "DELIVERED",
    paymentStatus: "PENDING",
  });

  if (!orders.length) {
    return res.json({ success: false, message: "No pending orders" });
  }

  const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  const gst = +(orders.reduce((g, o) => g + o.gst, 0).toFixed(2));
  const total = subtotal + gst;

  res.json({
    success: true,
    orders,
    summary: {
      subtotal,
      gst,
      total
    }
  });
});

export const finalizeRestaurantBill = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { 
    table_id, 
    discount = 0, 
    paymentMode = "CASH",
    customerName = "",
    customerPhone = ""
  } = req.body;

  const orders = await Order.find({
    hotel_id,
    table_id,
    status: "DELIVERED",
    paymentStatus: "PENDING",
  });

  if (!orders.length) {
    return res.status(400).json({
      success: false,
      message: "No pending orders",
    });
  }

  let subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  let gst = +(orders.reduce((g, o) => g + o.gst, 0).toFixed(2));
  let totalBeforeDiscount = subtotal + gst;
  let finalTotal = totalBeforeDiscount - discount;

  const billNumber = "BILL-" + Date.now();

  // Update orders
  await Order.updateMany(
    {
      table_id,
      hotel_id,
      status: "DELIVERED",
      paymentStatus: "PENDING",
    },
    {
      paymentStatus: "PAID",
      discount,
      billNumber,
      paidAt: new Date(),
    }
  );
  // Fetch hotel details
const hotel = await Hotel.findById(hotel_id).select("name address phone gstNumber");

  // Create Transaction
  await Transaction.create({
    hotel_id,
    type: "CREDIT",
    source: "RESTAURANT",
    amount: finalTotal,
    referenceId: billNumber,
    paymentMode,
    description: `Restaurant bill for Table ${table_id}`,
    createdBy: req.user._id,
  });

  // Create Bill
// after Transaction.create(...)
const bill = await Bill.create({
  hotel_id,
  billNumber,
  source: "RESTAURANT",
  referenceId: billNumber,
  table_id,
  customerName,
  customerPhone,
  subtotal,
  gst,
  discount,
  finalAmount: finalTotal,
  paymentMode,
  createdBy: req.user._id,
  orders: orders.map((o) => ({
    order_id: o._id,
    total: o.total,
    items: o.items,
  })),
});

const populatedBill = await Bill.findById(bill._id).populate("table_id");
  res.json({
    success: true,
    bill,
    hotel,
  });
});

export const getPendingRooms = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const rooms = await Room.find({ hotel_id });

  const result = [];

  for (const room of rooms) {
    const orders = await Order.find({
      hotel_id,
      room_id: room._id,
      status: "DELIVERED",
      paymentStatus: "PENDING",
    });

    if (!orders.length) continue;

    const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
    const gst = orders.reduce((s, o) => s + o.gst, 0);
    const total = subtotal + gst;

    result.push({
      roomId: room._id,
      number: room.number,
      orders,
      summary: { subtotal, gst, total }
    });
  }

  res.json({ success: true, rooms: result });
});

export const getRoomBill = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId } = req.params;

  const orders = await Order.find({
    hotel_id,
    room_id: roomId,
    status: "DELIVERED",
    paymentStatus: "PENDING",
  });

  if (!orders.length) {
    return res.json({ success: false, message: "No pending orders" });
  }

  const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  const gst = +(orders.reduce((s, o) => s + o.gst, 0).toFixed(2));
  const total = subtotal + gst;

  res.json({
    success: true,
    orders,
    summary: { subtotal, gst, total }
  });
});

export const finalizeRoomBill = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const {
    room_id,
    discount = 0,
    paymentMode = "CASH",
    customerName = "",
    customerPhone = ""
  } = req.body;

  const orders = await Order.find({
    hotel_id,
    room_id,
    status: "DELIVERED",
    paymentStatus: "PENDING",
  });

  if (!orders.length) {
    return res.status(400).json({
      success: false,
      message: "No pending orders",
    });
  }

  let subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  let gst = +(orders.reduce((s, o) => s + o.gst, 0).toFixed(2));
  let totalBeforeDiscount = subtotal + gst;
  let finalTotal = totalBeforeDiscount - discount;

  const billNumber = "BILL-" + Date.now();

  // Update orders
  await Order.updateMany(
    {
      hotel_id,
      room_id,
      status: "DELIVERED",
      paymentStatus: "PENDING",
    },
    {
      paymentStatus: "PAID",
      discount,
      billNumber,
      paidAt: new Date(),
    }
  );

  const hotel = await Hotel.findById(hotel_id).select("name address phone gstNumber");

  // Create transaction
  await Transaction.create({
    hotel_id,
    type: "CREDIT",
    source: "ROOM",
    amount: finalTotal,
    referenceId: billNumber,
    paymentMode,
    description: `Room bill for Room ${room_id}`,
    createdBy: req.user._id,
  });

  // Create bill entry
  const bill = await Bill.create({
    hotel_id,
    billNumber,
    source: "ROOM",
    referenceId: billNumber,
    room_id,
    customerName,
    customerPhone,
    subtotal,
    gst,
    discount,
    finalAmount: finalTotal,
    paymentMode,
    createdBy: req.user._id,
    orders: orders.map((o) => ({
      order_id: o._id,
      total: o.total,
      items: o.items,
    })),
  });

  const populatedBill = await Bill.findById(bill._id).populate("room_id");

  res.json({
    success: true,
    bill: populatedBill,
    hotel,
  });
});
