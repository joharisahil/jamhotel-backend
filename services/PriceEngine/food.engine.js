import { calculateFoodBillingForBooking } from "../foodBilling.service.js";

export const calculateFood = async (ctx, booking) => {
  const foodBill = await calculateFoodBillingForBooking(booking);

  ctx.food = {
    subtotal: Number(foodBill.summary.subtotal || 0),
    gst: Number(foodBill.summary.gst || 0),
    total: Number(foodBill.summary.total || 0),
    discountAmount: Number(foodBill.summary.discountAmount || 0),
  };
};
