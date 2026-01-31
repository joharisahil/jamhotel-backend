// services/foodBilling.service.js
import Order from "../models/Order.js";

export const calculateFoodBillingForBooking = async (booking) => {
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  const qrAndRoomOrders = await Order.find({
    room_id: booking.room_id,
    hotel_id: booking.hotel_id,
    createdAt: { $gte: checkIn, $lt: checkOut },
  });

  const transferredOrders = await Order.find({
    room_id: booking.room_id,
    hotel_id: booking.hotel_id,
    paymentStatus: "PENDING",
    status: "DELIVERED",
    createdAt: { $not: { $gte: checkIn, $lt: checkOut } },
  });

  const allOrders = [...qrAndRoomOrders, ...transferredOrders];

  const subtotal = allOrders.reduce(
    (sum, o) => sum + Number(o.subtotal || 0),
    0
  );

  const discountPercent = Number(booking.foodDiscount || 0);
  const discountAmount = +((subtotal * discountPercent) / 100).toFixed(2);
  const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

  const gst =
    booking.foodGSTEnabled && discountedSubtotal > 0
      ? +(discountedSubtotal * 0.05).toFixed(2)
      : 0;

  const total = +(discountedSubtotal + gst).toFixed(2);

  return {
    
    orders: allOrders,
    summary: {
      subtotal,
      discountPercent,
      discountAmount,
      gst,
      total,
      gstEnabled: booking.foodGSTEnabled,
    },
  };
};
