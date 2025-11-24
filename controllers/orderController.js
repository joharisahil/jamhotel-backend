import { asyncHandler } from "../utils/asyncHandler.js";
import * as orderService from "../services/orderService.js";
import { createOrderSchema } from "../validators/orderValidator.js";

export const createOrder = asyncHandler(async (req,res) => {
  const payload = createOrderSchema.parse(req.body);
  const result = await orderService.createOrder(payload);
  res.json({ success:true, ...result });
});

export const updateOrderStatus = asyncHandler(async (req,res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const order = await orderService.updateOrderStatus(orderId, status);
  res.json({ success:true, order });
});
