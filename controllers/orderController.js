import { asyncHandler } from "../utils/asyncHandler.js";
import * as orderService from "../services/orderService.js";
import { createOrderSchema } from "../validators/orderValidator.js";
import TableSession from "../models/TableSession.js";
import Order from "../models/Order.js"

export const createOrder = asyncHandler(async (req,res) => {
  const payload = createOrderSchema.parse(req.body);
  const result = await orderService.createOrder(payload);
  console.log("ORDER HOTEL ID:", payload.hotel_id);
  res.json({ success:true, ...result });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const order = await orderService.updateOrderStatus(orderId, status);

  res.json({ success: true, order });
});


export const getLiveOrders = asyncHandler(async (req, res) => {
  const { hotelId } = req.params;

const orders = await Order.find({
  hotel_id: hotelId,
  status: { $ne: "DELIVERED" }
})
.populate("table_id", "name")   // only return table name
.populate("room_id", "number"); // only return room number


  res.json({ success: true, orders });
});

export const createManualOrder = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    source: "MANUAL",
  };

  const result = await orderService.createOrder(payload);
  res.json({ success: true, ...result });
});

export const getOrdersByTable = asyncHandler(async (req, res) => {
  const { tableId } = req.params;
  const hotel_id = req.user.hotel_id;

  const table = await Table.findOne({ _id: tableId, hotel_id });

  if (!table?.activeSession?.sessionId) {
    return res.json({ success: true, orders: [], sessionId: null });
  }

  const session = await TableSession.findOne({
    _id: table.activeSession.sessionId,
    status: "ACTIVE",
  });

  if (!session) {
    return res.json({ success: true, orders: [], sessionId: null });
  }

  const orders = await Order.find({
    tableSession_id: session._id,
    paymentStatus: "PENDING",
  })
    .populate("table_id", "name")
    .sort({ createdAt: 1 });

  res.json({
    success: true,
    sessionId: session._id,
    orders,
  });
});


