import Order from "../models/Order.js";
import KOT from "../models/KOT.js";
import { emitToRole, emitToHotel } from "../utils/socket.js";
import MenuItem from "../models/MenuItem.js";

export const createOrder = async (payload) => {
  // compute prices
  let subtotal = 0;
  const items = [];
  for (const it of payload.items) {
    const menu = await MenuItem.findById(it.item_id);
    const unitPrice = it.size === "HALF" ? (menu.priceHalf || menu.priceFull/2) : menu.priceFull;
    const totalPrice = unitPrice * it.qty;
    subtotal += totalPrice;
    items.push({ item_id: it.item_id, name: menu.name, size: it.size, qty: it.qty, unitPrice, totalPrice });
  }
  const gst = +(subtotal * 0.05).toFixed(2); // 5% dummy
  const total = subtotal + gst;
  const order = await Order.create({ ...payload, items, subtotal, gst, total, status: "NEW" });
  // create KOT
  const kot = await KOT.create({ hotel_id: payload.hotel_id, order_id: order._id, ticketNumber: `KOT-${Date.now()}`, items: items.map(i => ({ item_id: i.item_id, name: i.name, size: i.size, qty: i.qty })) });
  // emit sockets
  emitToRole(payload.hotel_id, "KITCHEN_MANAGER", "order:created", { order, kot });
  emitToHotel(payload.hotel_id, "order:created", order);
  return { order, kot };
};

export const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
  emitToHotel(order.hotel_id, "order:status_update", order);
  return order;
};
