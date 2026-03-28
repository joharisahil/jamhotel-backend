//import asyncHandler from "express-async-handler";
import RoomBooking from "../../models/RoomBooking.js";
import Room from "../../models/Room.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { recalculateRoomBilling, convertBlockToBookingService  } from "../../services/bookingService.js";
import Order from "../../models/Order.js";
import { calculateFoodBillingForBooking } from "../../services/foodBilling.service.js";
import * as bookingService from "../../services/bookingService.js";

const splitGST = (finalAmount, gstRate = 5) => {
  const base = +(finalAmount / (1 + gstRate / 100)).toFixed(2);
  const gst = +(finalAmount - base).toFixed(2);
  return { base, gst };
};


/*main brain for all financial api's */
export const recalculatePayments = async (booking) => {
  if (!booking || !booking.room_id) return booking;

  /* ===================== RESET DERIVED FIELDS ===================== */
  // booking.discountAmount = 0;
  // booking.taxable = 0;
  // booking.cgst = 0;
  // booking.sgst = 0;
  // booking.grandTotal = 0;
  // booking.advancePaid = 0;
  // booking.balanceDue = 0;
  // booking.roundOffAmount = 0;

  /* ===================== NIGHTS ===================== */
  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) /
        (1000 * 60 * 60 * 24),
    ),
  );
  booking.nights = nights;

  const isFinalInclusive =
    booking.pricingType === "FINAL_INCLUSIVE" &&
    Number(booking.finalRoomPrice) > 0;

  /* ===================== ROOM BASE ===================== */
  let roomBase = 0;

  if (isFinalInclusive) {
    const { base } = splitGST(Number(booking.finalRoomPrice));
    roomBase = +(base * nights).toFixed(2);
  } else {
    let roomRate = 0;

    if (booking.room_id?.plans?.length && booking.planCode) {
      const [planCode, occupancy] = booking.planCode.split("_");
      const plan = booking.room_id.plans.find((p) => p.code === planCode);
      if (plan) {
        roomRate =
          occupancy === "SINGLE" ? plan.singlePrice : plan.doublePrice;
      }
    }

    if (!roomRate) roomRate = booking.room_id?.baseRate || 0;
    roomBase = +(roomRate * nights).toFixed(2);
  }

  booking.roomBase = roomBase;

  /* ===================== EXTRAS BASE ===================== */
  let extrasBase = 0;

  (booking.addedServices || []).forEach((s) => {
    const days =
      Array.isArray(s.days) && s.days.length > 0 ? s.days.length : nights;
    extrasBase += (s.price || 0) * days;
  });

  extrasBase = +extrasBase.toFixed(2);
  booking.extrasBase = extrasBase;

  /* ===================== DISCOUNT ===================== */
  const discountPercent = Math.min(Number(booking.discount || 0), 100);

  let discountOnRoom = 0;
  let discountOnExtras = 0;

  if (booking.discountScope === "ROOM") {
    discountOnRoom = +(roomBase * discountPercent / 100).toFixed(2);
  } else if (booking.discountScope === "EXTRAS") {
    discountOnExtras = +(extrasBase * discountPercent / 100).toFixed(2);
  } else {
    // TOTAL
    discountOnRoom = +(roomBase * discountPercent / 100).toFixed(2);
    discountOnExtras = +(extrasBase * discountPercent / 100).toFixed(2);
  }

  discountOnRoom = Math.min(discountOnRoom, roomBase);
  discountOnExtras = Math.min(discountOnExtras, extrasBase);

  booking.discountAmount = +(discountOnRoom + discountOnExtras).toFixed(2);

  /* ===================== TAXABLE ===================== */
  const taxableRoom = Math.max(roomBase - discountOnRoom, 0);
  const taxableExtras = Math.max(extrasBase - discountOnExtras, 0);

  booking.taxable = +(taxableRoom + taxableExtras).toFixed(2);

  /* ===================== GST (✔ FIXED) ===================== */
let totalGST = 0;

// Room GST
if (booking.gstEnabled) {
  totalGST += +(taxableRoom * 0.05).toFixed(2);
}

// Extras GST (respects gstEnabled per service)
let extrasGST = 0;

(booking.addedServices || []).forEach((s) => {
  if (!s.gstEnabled) return;

  const days =
    Array.isArray(s.days) && s.days.length > 0 ? s.days.length : nights;

  const base = (s.price || 0) * days;

  extrasGST += +(base * 0.05).toFixed(2);
});

totalGST += extrasGST;

booking.cgst = +(totalGST / 2).toFixed(2);
booking.sgst = +(totalGST / 2).toFixed(2);


  /* ===================== FOOD ===================== */
  const foodBill = await calculateFoodBillingForBooking(booking);

  booking.foodTotals = {
    subtotal: foodBill.summary.subtotal,
    gst: foodBill.summary.gst,
    total: foodBill.summary.total,
  };

  booking.foodDiscountAmount = foodBill.summary.discountAmount;

  /* ===================== GRAND TOTAL ===================== */
  let grandTotal =
    booking.taxable + totalGST + booking.foodTotals.total;

  if (booking.roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    booking.roundOffAmount = +(rounded - grandTotal).toFixed(2);
    grandTotal = rounded;
  }

  booking.grandTotal = +grandTotal.toFixed(2);

  /* ===================== ADVANCES ===================== */
  booking.advancePaid = (booking.advances || []).reduce(
    (sum, a) => sum + (a.amount || 0),
    0,
  );

  booking.balanceDue = Math.max(
    +(booking.grandTotal - booking.advancePaid).toFixed(2),
    0,
  );

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
  await recalculatePayments(booking);

  const remainingPayable = Number(
    (booking.grandTotal - booking.advancePaid).toFixed(0),
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
  await recalculatePayments(booking);
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

    await recalculatePayments(booking);
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
      (a) => a._id?.toString() === advanceId,
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
   await recalculatePayments(booking);
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

    await recalculatePayments(booking);

    // Add remaining balance as final payment if needed
    if (booking.balanceDue > 0) {
      booking.advances.push({
        amount: booking.balanceDue,
        mode: mode || "CASH",
        note: "Final payment",
      });
    }

    await recalculatePayments(booking);

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

export const updateRoomBilling = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { discount = 0, gstEnabled } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (booking.status === "CHECKED_OUT") {
    return res.status(400).json({
      success: false,
      message: "Checked-out bookings cannot be modified",
    });
  }

  booking.discount = Math.min(Math.max(Number(discount), 0), 100);
  booking.gstEnabled = Boolean(gstEnabled);

  await recalculatePayments(booking);
  await booking.save();

  res.json({
    success: true,
    booking,
  });
});

export const updateBookingServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { addedServices } = req.body;

  // ✅ MUST populate room_id
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

    if (days.length === 0) {
      throw new Error(
        `Please select at least one day for service "${
          s.name || `#${idx + 1}`
        }"`,
      );
    }

    return {
      name: String(s.name || "").trim(),
      price: Number(s.price) || 0,
      days,
      gstEnabled: s.gstEnabled !== false,
    };
  });

  /* ================= RECALCULATE (SINGLE SOURCE OF TRUTH) ================= */
  await recalculatePayments(booking);

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

  // ✅ ONLY update inputs (NO CALCULATION HERE)
  booking.foodDiscount = Math.min(Math.max(Number(foodDiscount), 0), 100);
  booking.foodGSTEnabled = Boolean(foodGSTEnabled);

  // ✅ SINGLE SOURCE OF TRUTH
  await recalculatePayments(booking);
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
  },
);

export const getBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking) {
    return res
      .status(404)
      .json({ success: false, message: "Booking not found" });
  }

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res
      .status(403)
      .json({ success: false, message: "Forbidden" });
  }

  // ✅ IMPORTANT FIX: always recalculate totals
  booking = await recalculatePayments(booking);

  res.json({ success: true, booking });
});

export const resolveBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { bookingId, roomId } = req.params;
  const { date } = req.query;

  let booking = null;

  /* ===================== 1️⃣ BOOKING ID (ABSOLUTE TRUTH) ===================== */
  if (bookingId) {
    booking = await RoomBooking.findById(bookingId).populate("room_id");

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (String(booking.hotel_id) !== String(hotel_id)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden" });
    }

    // ✅ keep your existing business logic
    booking = await recalculatePayments(booking);

    return res.json({ success: true, booking });
  }

  /* ===================== 2️⃣ ROOM CONTEXT ===================== */
  if (!roomId) {
    return res
      .status(400)
      .json({ success: false, message: "roomId is required" });
  }

  // date provided → use it
  // date missing → default to NOW (today behavior)
 const targetDate = date
  ? new Date(`${date}T00:00:00.000+05:30`) // IST-safe
  : new Date();


  booking = await RoomBooking.findOne({
    hotel_id,
    room_id: roomId,
    status: { $nin: ["CANCELLED", "CHECKEDOUT"] },
    checkIn: { $lte: targetDate },
    checkOut: { $gt: targetDate },
  }).populate("room_id");

  return res.json({
    success: true,
    booking: booking || null,
  });
});

export const blockRoom = asyncHandler(async (req, res, next) => {
  try {
    const { room_id, checkIn, checkOut, reason } = req.body;

    if (!room_id || !checkIn || !checkOut) {
      return res.status(400).json({
        message: "room_id, checkIn and checkOut are required",
      });
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      return res.status(400).json({
        message: "checkOut must be after checkIn",
      });
    }

    // 🔒 Prevent overlapping bookings / blocks
    const conflict = await RoomBooking.findOne({
      room_id,
      status: { $in: ["CONFIRMED", "OCCUPIED", "BLOCKED", "MAINTENANCE"] },
      $or: [
        {
          checkIn: { $lt: new Date(checkOut) },
          checkOut: { $gt: new Date(checkIn) },
        },
      ],
    });

    if (conflict) {
      return res.status(409).json({
        message: "Room is already booked or blocked for selected dates",
      });
    }

    const booking = await RoomBooking.create({
      hotel_id: req.user.hotel_id,
      room_id,

      source: "WALK_IN",
      status: "BLOCKED",

      checkIn,
      checkOut,

      // 🧑 Guest placeholders
      guestName: "BLOCKED",
      guestPhone: null,
      guestCity: null,
      guestNationality: null,
      guestAddress: null,
      guestIds: [],

      // 🏢 Company placeholders
      companyName: "-",
      companyGSTIN: null,
      companyAddress: null,

      // 👨‍👩‍👧‍👦 Counts
      adults: 0,
      children: 0,

      // 💰 Billing zeroed
      taxable: 0,
      cgst: 0,
      sgst: 0,
      grandTotal: 0,
      advancePaid: 0,
      balanceDue: 0,

      notes: reason || "Room blocked",
    });

    res.status(201).json({
      message: "Room blocked successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
});

export const unblockRoom = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find blocked booking
    const booking = await RoomBooking.findOne({
      _id: id,
      hotel_id: req.user.hotel_id,
      status: "BLOCKED",
    }).populate("room_id", "number");

    if (!booking) {
      return res.status(404).json({
        message: "Blocked booking not found",
      });
    }

    // 2️⃣ Update status instead of deleting (recommended)
    booking.status = "CANCELLED";
    booking.notes = (booking.notes || "") + " | Unblocked manually";

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Room unblocked successfully",
      room: {
        roomId: booking.room_id._id,
        roomNumber: booking.room_id.number,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const blockSelectedRooms = asyncHandler(async (req, res, next) => {
  try {
    const { roomIds, checkIn, checkOut, reason } = req.body;

    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({
        message: "roomIds array is required",
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: "checkIn and checkOut are required",
      });
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      return res.status(400).json({
        message: "checkOut must be after checkIn",
      });
    }

    // 1️⃣ Fetch selected rooms (for room numbers)
    const rooms = await Room.find({
      hotel_id: req.user.hotel_id,
      _id: { $in: roomIds },
      status: { $ne: "DELETED" },
    }).select("_id number");

    if (rooms.length !== roomIds.length) {
      return res.status(400).json({
        message: "One or more rooms are invalid",
      });
    }

    // 2️⃣ Check conflicts ONLY for selected rooms
    const conflicts = await RoomBooking.find({
      hotel_id: req.user.hotel_id,
      room_id: { $in: roomIds },
      status: { $in: ["CONFIRMED", "OCCUPIED", "BLOCKED", "MAINTENANCE"] },
      checkIn: { $lt: new Date(checkOut) },
      checkOut: { $gt: new Date(checkIn) },
    }).populate("room_id", "number");

    if (conflicts.length > 0) {
      return res.status(409).json({
        message: "Some selected rooms are already booked or blocked",
        conflicts: conflicts.map((b) => ({
          roomId: b.room_id._id,
          roomNumber: b.room_id.number,
          status: b.status,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
        })),
      });
    }

    // 3️⃣ Block ONLY selected rooms
    const bookings = rooms.map((room) => ({
      hotel_id: req.user.hotel_id,
      room_id: room._id,

      source: "WALK_IN",
      status: "BLOCKED",

      checkIn,
      checkOut,

      guestName: "BLOCKED",
      companyName: "-",
      guestIds: [],

      taxable: 0,
      cgst: 0,
      sgst: 0,
      grandTotal: 0,

      notes: reason || "Rooms blocked",
    }));

    await RoomBooking.insertMany(bookings);

    res.status(201).json({
      message: "Selected rooms blocked successfully",
      blockedRooms: rooms.map((r) => ({
        roomId: r._id,
        roomNumber: r.number,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export const convertBlockToBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await bookingService.convertBlockToBookingService ({
    hotel_id: req.user.hotel_id,
    bookingId: id,
    payload: req.body,
  });

  res.status(200).json({
    success: true,
    message: "Block converted successfully",
    booking,
  });
});
