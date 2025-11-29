import { asyncHandler } from "../utils/asyncHandler.js";
import * as orderService from "../services/orderService.js";
import { createOrderSchema } from "../validators/orderValidator.js";
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

