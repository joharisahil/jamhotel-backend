//import asyncHandler from "express-async-handler";
import RoomBooking from "../../models/RoomBooking.js";
import Room from "../../models/Room.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recalculateRoomBilling } from "../../services/bookingService.js";
import Order from "../../models/Order.js";
/* =====================================================
   🔁 FULL & SINGLE SOURCE OF TRUTH
   ===================================================== */
export const recalculatePayments = (booking) => {
  if (!booking || !booking.room_id) return booking;

  /* ===================== NIGHTS ===================== */
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  const nights = Math.max(
    1,
    Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  );

  booking.nights = nights;

  /* ===================== ROOM PRICE ===================== */
  let roomPrice = 0;

  if (booking.room_id?.plans?.length && booking.planCode) {
    const [planCode, occupancy] = booking.planCode.split("_");
    const plan = booking.room_id.plans.find((p) => p.code === planCode);

    if (plan) {
      roomPrice = occupancy === "SINGLE" ? plan.singlePrice : plan.doublePrice;
    }
  }

  if (!roomPrice) {
    roomPrice = booking.room_id?.baseRate || 0;
  }

  booking.roomPrice = roomPrice;
  booking.roomStayTotal = +(roomPrice * nights).toFixed(2);

  /* ===================== EXTRAS ===================== */
  let extrasBase = 0;

  (booking.addedServices || []).forEach((service) => {
    const days =
      Array.isArray(service.days) && service.days.length > 0
        ? service.days.length
        : nights;

    extrasBase += (service.price || 0) * days;
  });

  booking.extrasBase = +extrasBase.toFixed(2);

  const extrasGST = booking.gstEnabled ? +(extrasBase * 0.05).toFixed(2) : 0;

  booking.extrasGST = extrasGST;
  booking.extrasTotal = +(extrasBase + extrasGST).toFixed(2);

  /* ===================== DISCOUNT ===================== */
  const discountPercent = Number(booking.discount || 0);
  booking.discountAmount = +(
    ((booking.roomStayTotal + extrasBase) * discountPercent) /
    100
  ).toFixed(2);

  /* ===================== TAX ===================== */
  const taxableAmount = booking.gstEnabled
    ? booking.roomStayTotal + extrasBase - booking.discountAmount
    : 0;

  const gstTotal = booking.gstEnabled ? +(taxableAmount * 0.05).toFixed(2) : 0;

  booking.taxable = +taxableAmount.toFixed(2);
  booking.cgst = +(gstTotal / 2).toFixed(2);
  booking.sgst = +(gstTotal / 2).toFixed(2);

  /* ===================== FOOD ===================== */
  const foodSubtotal = booking.foodTotals?.subtotal || 0;
  const foodDiscountPercent = Number(booking.foodDiscount || 0);

  booking.foodDiscountAmount = +(
    (foodSubtotal * foodDiscountPercent) /
    100
  ).toFixed(2);

  const foodAfterDiscount = foodSubtotal - booking.foodDiscountAmount;

  const foodGST = booking.foodGSTEnabled
    ? +(foodAfterDiscount * 0.05).toFixed(2)
    : 0;

  booking.foodTotals = {
    subtotal: +foodSubtotal.toFixed(2),
    gst: foodGST,
    total: +(foodAfterDiscount + foodGST).toFixed(2),
  };

  /* ===================== GRAND TOTAL ===================== */
  let grandTotal =
    booking.taxable + booking.cgst + booking.sgst + booking.foodTotals.total;

  /* ===================== ROUND OFF ===================== */
  let roundOffAmount = 0;

  if (booking.roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    roundOffAmount = +(rounded - grandTotal).toFixed(2);
    grandTotal = rounded;
  }

  booking.roundOffAmount = roundOffAmount;
  booking.grandTotal = +grandTotal.toFixed(2);

  /* ===================== ADVANCES ===================== */
  booking.advancePaid = (booking.advances || []).reduce(
    (sum, a) => sum + (a.amount || 0),
    0
  );

  /* ===================== BALANCE (NEVER NEGATIVE) ===================== */
  booking.balanceDue = Math.max(
    +(booking.grandTotal - booking.advancePaid).toFixed(2),
    0
  );

  /* ===================== FINAL PAYMENT ===================== */
  booking.finalPaymentReceived = booking.balanceDue === 0;
  booking.finalPaymentAmount = booking.finalPaymentReceived
    ? booking.grandTotal
    : 0;

  return booking;
};

/* POST /api/bookings/:id/advance */
export const addAdvancePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, mode, date, note } = req.body;

  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error("Advance amount must be greater than 0");
  }

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }

  // ❌ Cannot add advance after checkout
  if (booking.status === "CHECKEDOUT") {
    res.status(400);
    throw new Error("Cannot add advance after checkout");
  }

  // ✅ ALWAYS calculate latest bill first
  recalculatePayments(booking);

  const remainingPayable = Number(
    (booking.grandTotal - booking.advancePaid).toFixed(0)
  );

  const EPSILON = 2;

  if (amount - remainingPayable > EPSILON) {
    return res.status(400).json({
      success: false,
      message: `Advance cannot exceed remaining balance (${remainingPayable})`,
    });
  }
  const newAdvance = booking.advances.create({
    amount,
    mode: mode || "CASH",
    note: note || "",
    date: date ? new Date(date) : new Date(),
  });

  booking.advances.push(newAdvance);

  // 🔁 Recalculate again after adding advance
  recalculatePayments(booking);
  await booking.save();

  res.status(200).json({
    success: true,
    message: "Advance payment added",
    advance: newAdvance,
    booking,
  });
});

/* PUT /api/bookings/:bookingId/advance/:index NOT IN USE*/
export const updateAdvancePayment = async (req, res) => {
  try {
    const { bookingId, advanceId } = req.params;
    const { amount, mode, note } = req.body;

    const booking = await RoomBooking.findById(bookingId);
    if (!booking || !booking.advances[advanceId]) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (booking.finalPaymentReceived) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify advances after final payment",
      });
    }

    if (amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Advance amount must be greater than 0",
        });
      }
      booking.advances[advanceId].amount = amount;
    }

    if (mode) booking.advances[advanceId].mode = mode;
    if (note !== undefined) booking.advances[advanceId].note = note;

    recalculatePayments(booking);
    await booking.save();

    res.json({
      success: true,
      message: "Advance updated",
      booking,
    });
  } catch (error) {
    console.error("Update Advance Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* DELETE /api/bookings/:bookingId/advance/:index */
export const removeAdvancePayment = asyncHandler(async (req, res) => {
  try {
    const { id: bookingId, advanceId } = req.params;

    const booking = await RoomBooking.findById(bookingId).populate("room_id");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // ❌ Do not allow removal after checkout
    if (booking.status === "CHECKEDOUT") {
      return res.status(400).json({
        success: false,
        message: "Cannot remove advances after checkout",
      });
    }

    const index = booking.advances.findIndex(
      (a) => a._id?.toString() === advanceId
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    // 🗑 Remove advance
    booking.advances.splice(index, 1);

    // 🔁 Recalculate full bill
    recalculatePayments(booking);
    await booking.save();

    res.json({
      success: true,
      message: "Advance removed",
      booking,
    });
  } catch (error) {
    console.error("Remove Advance Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* POST /api/bookings/:id/checkout */
export const finalCheckout = async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.body;

    const booking = await RoomBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.finalPaymentReceived) {
      return res.status(400).json({
        success: false,
        message: "Checkout already completed",
      });
    }

    recalculatePayments(booking);

    // Add remaining balance as final payment if needed
    if (booking.balanceDue > 0) {
      booking.advances.push({
        amount: booking.balanceDue,
        mode: mode || "CASH",
        note: "Final payment",
      });
    }

    recalculatePayments(booking);

    booking.finalPaymentReceived = true;
    booking.finalPaymentMode = mode || "CASH";
    booking.finalPaymentAmount = booking.advancePaid;
    booking.actualCheckoutTime = new Date();
    booking.status = "CHECKED_OUT";

    await booking.save();

    res.json({
      success: true,
      message: "Checkout completed successfully",
      booking,
    });
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const updateRoomBilling = async (req, res) => {
  const { id } = req.params;
  const { discount = 0, gstEnabled } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.status === "CHECKEDOUT") {
    return res.status(400).json({
      success: false,
      message: "Checked-out bookings cannot be modified",
    });
  }

  /* ===================== 1️⃣ NIGHTS ===================== */
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) / MS_PER_DAY
    )
  );

  /* ===================== 2️⃣ ROOM RATE ===================== */
  const [planCode, occupancy] = String(booking.planCode).split("_");
  const plan = booking.room_id?.plans?.find((p) => p.code === planCode);

  if (!plan) {
    return res.status(400).json({
      success: false,
      message: "Invalid room plan",
    });
  }

  const roomRate = occupancy === "SINGLE" ? plan.singlePrice : plan.doublePrice;

  const roomBase = +(roomRate * nights).toFixed(2);

  /* ===================== 3️⃣ EXTRA SERVICES ===================== */
  const extrasBase = (booking.addedServices || []).reduce((sum, s) => {
    const days = Array.isArray(s.days) ? s.days.length : 0;
    return sum + Number(s.price || 0) * days;
  }, 0);

  const base = +(roomBase + extrasBase).toFixed(2);

  /* ===================== 4️⃣ DISCOUNT (ON TOTAL) ===================== */
  const discountPercent = Math.min(Math.max(Number(discount), 0), 100);
  const discountAmount = +((base * discountPercent) / 100).toFixed(2);

  const taxable = Math.max(base - discountAmount, 0);

  /* ===================== 5️⃣ GST (AFTER DISCOUNT) ===================== */
  const cgst = gstEnabled && taxable > 0 ? +(taxable * 0.025).toFixed(2) : 0;

  const sgst = gstEnabled && taxable > 0 ? +(taxable * 0.025).toFixed(2) : 0;

  const roomTotal = +(taxable + cgst + sgst).toFixed(2);

  /* ===================== 6️⃣ ADVANCES ===================== */
  const advancePaid = Array.isArray(booking.advances)
    ? booking.advances.reduce((sum, a) => sum + Number(a.amount || 0), 0)
    : Number(booking.advancePaid || 0);

  /* ===================== 7️⃣ FINAL TOTALS ===================== */
  const foodTotal = booking.foodTotals?.total || 0;

  const grandTotal = +(roomTotal + foodTotal).toFixed(2);
  const balanceDue = +(grandTotal - advancePaid).toFixed(2);
  const finalPaymentReceived = balanceDue <= 0;

  /* ===================== 8️⃣ SAVE ===================== */
  booking.nights = nights;

  booking.roomBase = roomBase;
  booking.extrasBase = extrasBase;

  booking.discount = discountPercent;
  booking.discountAmount = discountAmount;

  booking.taxable = taxable;
  booking.cgst = cgst;
  booking.sgst = sgst;

  booking.gstEnabled = gstEnabled;
  booking.grandTotal = grandTotal;

  booking.advancePaid = advancePaid;
  booking.balanceDue = balanceDue;
  booking.finalPaymentReceived = finalPaymentReceived;

  await booking.save();

  /* ===================== RESPONSE ===================== */
  res.json({
    success: true,
    booking,
    summary: {
      roomTotal,
      foodTotal,
      totalAdvance: advancePaid,
      balanceDue,
    },
  });
};

export const updateBookingServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { addedServices } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.status === "CHECKEDOUT") {
    return res.status(400).json({
      success: false,
      message: "Checked-out bookings cannot be modified",
    });
  }

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  if (!Array.isArray(addedServices)) {
    return res.status(400).json({
      success: false,
      message: "Invalid services payload",
    });
  }

  /* ================= SANITIZE + VALIDATE ================= */
  booking.addedServices = addedServices.map((s, idx) => {
    const days = Array.isArray(s.days)
      ? s.days.map(Number).filter((d) => d > 0)
      : [];

    // 🔴 HARD VALIDATION
    if (days.length === 0) {
      throw new Error(
        `Please select at least one day for service "${
          s.name || `#${idx + 1}`
        }"`
      );
    }

    return {
      name: String(s.name || "").trim(),
      price: Number(s.price) || 0,
      days,
      gstEnabled: s.gstEnabled !== false,
    };
  });

  /* ================= LOAD ROOM ================= */
  const room = await Room.findById(booking.room_id);
  if (!room) {
    return res.status(400).json({
      success: false,
      message: "Room not found for recalculation",
    });
  }

  /* ================= RECALCULATE BILLING ================= */
  await recalculateRoomBilling(booking, room);

  /* ================= SAVE ================= */
  await booking.save();

  res.json({
    success: true,
    message: "Extra services updated successfully",
    booking,
  });
});

export const updateFoodBilling = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { foodDiscount = 0, foodGSTEnabled = true } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking) {
    return res
      .status(404)
      .json({ success: false, message: "Booking not found" });
  }

  if (booking.status === "CHECKEDOUT") {
    return res.status(400).json({
      success: false,
      message: "Checked-out bookings cannot be modified",
    });
  }

  /* ===================== ORDERS ===================== */
  const orders = await Order.find({
    booking_id: booking._id,
    status: "DELIVERED",
  });

  const subtotal = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);

  /* ===================== DISCOUNT ===================== */
  const discountPercent = Number(foodDiscount || 0);
  const discountAmount = +((subtotal * discountPercent) / 100).toFixed(2);

  const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

  /* ===================== GST ===================== */
  const gst = foodGSTEnabled ? +(discountedSubtotal * 0.05).toFixed(2) : 0;

  const total = +(discountedSubtotal + gst).toFixed(2);

  /* ===================== SAVE ===================== */
  booking.foodDiscount = discountPercent;
  booking.foodDiscountAmount = discountAmount;
  booking.foodGSTEnabled = foodGSTEnabled;

  booking.foodTotals = {
    subtotal: discountedSubtotal,
    gst,
    total,
  };

  await booking.save();

  res.json({
    success: true,
    booking,
    summary: booking.foodTotals,
  });
});

//previously it's named as getRoomServiceBillForBooking
export const getFoodBillingSummaryForBooking = asyncHandler(
  async (req, res) => {
    const bookingId = req.params.bookingId;

    const booking = await RoomBooking.findById(bookingId);
    if (!booking) {
      return res.json({ success: true, orders: [], summary: null });
    }

    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);

    /* -----------------------------------------
     * 1️⃣ FETCH ORDERS (UNCHANGED LOGIC)
     * ----------------------------------------- */
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

    /* -----------------------------------------
     * 2️⃣ SUBTOTAL (FOOD ONLY)
     * ----------------------------------------- */
    const subtotal = allOrders.reduce((sum, o) => sum + o.subtotal, 0);

    /* -----------------------------------------
     * 3️⃣ DISCOUNT (ON SUBTOTAL ONLY)
     * ----------------------------------------- */
    const discountPercent = booking.foodDiscount || 0;
    const discountAmount = +((subtotal * discountPercent) / 100).toFixed(2);
    const discountedSubtotal = +(subtotal - discountAmount).toFixed(2);

    /* -----------------------------------------
     * 4️⃣ GST (AFTER DISCOUNT)
     * ----------------------------------------- */
    let gst = 0;
    if (booking.foodGSTEnabled) {
      gst = +(discountedSubtotal * 0.05).toFixed(2); // 5% GST
    }

    /* -----------------------------------------
     * 5️⃣ FINAL TOTAL
     * ----------------------------------------- */
    const total = +(discountedSubtotal + gst).toFixed(2);

    return res.json({
      success: true,
      orders: allOrders,
      summary: {
        subtotal,
        discountPercent,
        discountAmount,
        gst, // TOTAL GST (5%)
        total,
        gstEnabled: booking.foodGSTEnabled,
      },
    });
  }
);
