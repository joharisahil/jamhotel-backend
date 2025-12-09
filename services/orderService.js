import Order from "../models/Order.js";
import KOT from "../models/KOT.js";
import MenuItem from "../models/MenuItem.js";
import Table from "../models/Table.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";
import { emitToHotel, emitToRole } from "../utils/socket.js";   

export const createOrder = async (payload) => {
  let subtotal = 0;
  const items = [];

  for (const it of payload.items) {
    const menu = await MenuItem.findById(it.item_id);

    const resolvePrice = (menu, size) => {
      if (size === "HALF") return menu.priceHalf ?? (menu.priceFull / 2);
      if (size === "FULL") return menu.priceFull;
      return menu.priceSingle ?? menu.priceFull;
    };

    const unitPrice = resolvePrice(menu, it.size);
    const totalPrice = unitPrice * it.qty;
    subtotal += totalPrice;

    items.push({
      item_id: it.item_id,
      name: menu.name,
      size: it.size,
      qty: it.qty,
      unitPrice,
      totalPrice,
    });
  }

  const gst = +(subtotal * 0.05).toFixed(2);
  const total = subtotal + gst;

  // Create base order
  const order = await Order.create({
    ...payload,
    items,
    subtotal,
    gst,
    total,
    status: "NEW",
  });

  // Resolve table string → ObjectId
  if (payload.table_id && !mongoose.isValidObjectId(payload.table_id)) {
    const tbl = await Table.findOne({
      hotel_id: payload.hotel_id,
      $or: [
        { name: payload.table_id },
        { name: `Table ${payload.table_id}` },
        { name: `T${payload.table_id}` },
      ],
    });
  if (!tbl || tbl.sessionToken !== payload.sessionToken) {
    return { success: false, message: "QR session expired. Please rescan." };
  }

    if (tbl) {
      await Order.findByIdAndUpdate(order._id, { table_id: tbl._id });
    }
  }

  // Resolve room string → ObjectId
  if (payload.room_id && !mongoose.isValidObjectId(payload.room_id)) {
    const rm = await Room.findOne({
      hotel_id: payload.hotel_id,
      number: payload.room_id,
    });
      if (!room || room.sessionToken !== payload.sessionToken) {
    return { success: false, message: "QR session expired. Please rescan." };
  }

    if (rm) {
      await Order.findByIdAndUpdate(order._id, { room_id: rm._id });
    }
  }

  // Fetch populated order
  const populatedOrder = await Order.findById(order._id)
    .populate("table_id", "name")
    .populate("room_id", "number");

  // Create KOT
  const kot = await KOT.create({
    hotel_id: payload.hotel_id,
    order_id: order._id,
    ticketNumber: `KOT-${Date.now()}`,
    items: items.map((i) => ({
      item_id: i.item_id,
      name: i.name,
      size: i.size,
      qty: i.qty,
    })),
  });

  // Socket emit (consistent payload)
  const data = { order: populatedOrder, kot };

  emitToRole(payload.hotel_id, "KITCHEN_MANAGER", "order:created", data);
  emitToHotel(payload.hotel_id, "order:created", data);

  return data;
};

export const updateOrderStatus = async (orderId, status) => {
  // Update order
  await Order.findByIdAndUpdate(orderId, { status });

  // Fetch populated order
  const populatedOrder = await Order.findById(orderId)
    .populate("table_id", "name")
    .populate("room_id", "number");

    // 🔥 CLEAR SESSION TOKEN if delivered
  if (status === "DELIVERED") {
    if (populatedOrder.room_id) {
      await Room.findByIdAndUpdate(populatedOrder.room_id._id, {
        sessionToken: null
      });
    }
    if (populatedOrder.table_id) {
      await Table.findByIdAndUpdate(populatedOrder.table_id._id, {
        sessionToken: null
      });
    }
  }  

  // Emit updated populated order
  emitToHotel(populatedOrder.hotel_id, "order:status_update", populatedOrder);

  return populatedOrder;
};

