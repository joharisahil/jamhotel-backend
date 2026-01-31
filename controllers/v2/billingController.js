import Order from "../../models/Order.js";
import RoomBooking from "../../models/RoomBooking.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recalculatePayments } from "./roomBookingController.js";

export const getRoomBill = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId } = req.params;

  /* ---------------------------------------------------
     1️⃣ Get active booking (SOURCE OF TRUTH)
  --------------------------------------------------- */
  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: roomId,
    status: { $nin: ["CANCELLED", "CHECKEDOUT"] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "No active booking found for this room"
    });
  }

  /* ---------------------------------------------------
     2️⃣ Force correct pricing (FINAL_INCLUSIVE safe)
     This fixes:
     - advance booking issues
     - stale DB totals
     - plan price leakage
  --------------------------------------------------- */
  await recalculatePayments(booking);

  /* ---------------------------------------------------
     3️⃣ Fetch pending food orders
  --------------------------------------------------- */
  const orders = await Order.find({
    hotel_id,
    room_id: roomId,
    status: "DELIVERED",
    paymentStatus: "PENDING"
  });

  const foodSubtotal = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const foodGST = +orders
    .reduce((sum, o) => sum + (o.gst || 0), 0)
    .toFixed(2);

  const foodTotal = +(foodSubtotal + foodGST).toFixed(2);

  /* ---------------------------------------------------
     4️⃣ Final live bill calculation
     (ROOM + FOOD − ADVANCE)
  --------------------------------------------------- */
  const roomTotal = booking.grandTotal;
  const advancePaid = booking.advancePaid || 0;

  const grandTotal = +(roomTotal + foodTotal).toFixed(2);
  const balanceDue = +(grandTotal - advancePaid).toFixed(2);

  /* ---------------------------------------------------
     5️⃣ Response (NO invoice mutation here)
  --------------------------------------------------- */
  res.json({
    success: true,
    bookingId: booking._id,

    roomBill: {
      pricingType: booking.pricingType,
      nights: booking.nights || 1,
      taxable: booking.taxable,
      cgst: booking.cgst,
      sgst: booking.sgst,
      total: roomTotal
    },

    foodBill: {
      orders,
      subtotal: foodSubtotal,
      gst: foodGST,
      total: foodTotal
    },

    payments: {
      advancePaid,
      grandTotal,
      balanceDue
    }
  });
});
