// services/bookingService.js
import mongoose from "mongoose";
import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import RoomInvoice from "../models/RoomInvoice.js";
import Order from "../models/Order.js";
import * as transactionService from "./transactionService.js"; // adjust path if needed
import { recalculatePayments } from "../controllers/v2/roomBookingController.js";
const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function getFoodSummary(bookingId) {
  const orders = await Order.find({
    booking_id: bookingId,
    status: "DELIVERED",
  });

  let subtotal = 0;
  let gst = 0;

  orders.forEach((o) => {
    subtotal += o.subtotal || 0;
    gst += o.gst || 0;
  });

  return {
    subtotal: +subtotal.toFixed(2),
    gst: +gst.toFixed(2),
    total: +(subtotal + gst).toFixed(2),
  };
}
const splitGST = (finalAmount, gstRate = 5) => {
  const base = +(finalAmount / (1 + gstRate / 100)).toFixed(2);
  const gst = +(finalAmount - base).toFixed(2);
  return { base, gst };
};
const normalizeServiceDays = (booking, nights) => {
  booking.addedServices = booking.addedServices.map((s) => {
    // If days already defined → keep them
    if (Array.isArray(s.days) && s.days.length > 0) {
      return s;
    }

    // 🔒 Freeze service to original stay length (ONE-TIME)
    return {
      ...s,
      days: [1], // applies once, NOT per-night
    };
  });
};

// export const recalculateRoomBilling = async (booking, room) => {
//   const checkInDT = new Date(booking.checkIn);
//   const checkOutDT = new Date(booking.checkOut);

//   const rawDays =
//     (checkOutDT.getTime() - checkInDT.getTime()) / MS_PER_DAY;

//   const nights = Math.max(1, Math.ceil(rawDays));

//   // 🔐 FREEZE SERVICE DAYS (CRITICAL FIX)
//   normalizeServiceDays(booking, nights);

//   // ---------------- ROOM RATE ----------------
//   const [planCode, type] = String(booking.planCode).split("_");
//   const plan = room.plans.find(p => p.code === planCode);

//   if (!plan) throw new Error("Invalid plan during recalculation");

//   const roomRate =
//     type === "SINGLE" ? plan.singlePrice : plan.doublePrice;

//   const roomBase = +(roomRate * nights).toFixed(2);

//   // ---------------- EXTRA SERVICES ----------------
//   let extrasBase = 0;

//   booking.addedServices.forEach(s => {
//     const validDays = [...new Set(s.days)].filter(
//       d => d >= 1 && d <= nights
//     );

//     extrasBase += Number(s.price || 0) * validDays.length;
//   });

//   // ---------------- DISCOUNT ----------------
//   const discountPercent = Number(booking.discount || 0);
//   const discountScope = booking.discountScope || "TOTAL";

//   let discountedRoomBase = roomBase;
//   let discountedExtrasBase = extrasBase;
//   let discountAmount = 0;

//   if (discountPercent > 0) {
//     const gross = roomBase + extrasBase || 1;

//     if (discountScope === "TOTAL") {
//       discountAmount = +(gross * discountPercent / 100).toFixed(2);
//       discountedRoomBase -= +(discountAmount * roomBase / gross).toFixed(2);
//       discountedExtrasBase -= +(discountAmount * extrasBase / gross).toFixed(2);
//     }

//     if (discountScope === "ROOM") {
//       discountAmount = +(roomBase * discountPercent / 100).toFixed(2);
//       discountedRoomBase -= discountAmount;
//     }

//     if (discountScope === "EXTRAS") {
//       discountAmount = +(extrasBase * discountPercent / 100).toFixed(2);
//       discountedExtrasBase -= discountAmount;
//     }
//   }

//   // ---------------- GST ----------------
//   let gstBase = 0;

//   if (booking.gstEnabled) {
//     gstBase += discountedRoomBase;

//     booking.addedServices.forEach(s => {
//       if (s.gstEnabled !== false) {
//         const validDays = s.days.filter(d => d >= 1 && d <= nights);
//         const base = Number(s.price || 0) * validDays.length;

//         const ratio =
//           extrasBase > 0 ? discountedExtrasBase / extrasBase : 0;

//         gstBase += base * ratio;
//       }
//     });
//   }

//   const totalGST = +(gstBase * 0.05).toFixed(2);
//   const cgst = +(totalGST / 2).toFixed(2);
//   const sgst = +(totalGST / 2).toFixed(2);

//   const taxable = +(discountedRoomBase + discountedExtrasBase).toFixed(2);

//   // ---------------- TOTAL / ROUNDING ----------------
//   let total = taxable + totalGST;
//   let roundOffAmount = 0;

//   if (booking.roundOffEnabled) {
//     const rounded = Math.round(total);
//     roundOffAmount = +(rounded - total).toFixed(2);
//     total = rounded;
//   }

//   const balanceDue = Math.max(
//     0,
//     +(total - Number(booking.advancePaid || 0)).toFixed(2)
//   );

//   // ---------------- ASSIGN BACK ----------------
//   booking.taxable = taxable;
//   booking.cgst = cgst;
//   booking.sgst = sgst;
//   booking.discountAmount = discountAmount;
//   booking.roundOffAmount = roundOffAmount;
//   booking.balanceDue = balanceDue;
// };

/*v2 correct */

export const recalculateRoomBilling = async (booking, room) => {
  /* ===================== NIGHTS ===================== */
  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) / MS_PER_DAY,
    ),
  );
  booking.nights = nights;

  /* ===================== ROOM RATE ===================== */
  const [planCode, occupancy] = String(booking.planCode).split("_");
  const plan = room.plans.find((p) => p.code === planCode);
  if (!plan) throw new Error("Invalid plan during recalculation");

  const roomRate = occupancy === "SINGLE" ? plan.singlePrice : plan.doublePrice;

  const roomBase = +(roomRate * nights).toFixed(2);

  /* ===================== EXTRA SERVICES ===================== */
  let extrasBase = 0;

  booking.addedServices.forEach((s) => {
    if (!Array.isArray(s.days) || s.days.length === 0) {
      throw new Error(
        `Service "${s.name}" must have at least one day selected`,
      );
    }

    const validDays = [...new Set(s.days)].filter((d) => d >= 1 && d <= nights);

    extrasBase += Number(s.price || 0) * validDays.length;
  });

  extrasBase = +extrasBase.toFixed(2);

  /* ===================== DISCOUNT ===================== */
  const discountPercent = Number(booking.discount || 0);
  const discountScope = booking.discountScope || "TOTAL";

  let discountedRoom = roomBase;
  let discountedExtras = extrasBase;
  let discountAmount = 0;

  if (discountPercent > 0) {
    if (discountScope === "TOTAL") {
      const gross = roomBase + extrasBase || 1;
      discountAmount = +((gross * discountPercent) / 100).toFixed(2);

      discountedRoom -= +((discountAmount * roomBase) / gross).toFixed(2);
      discountedExtras -= +((discountAmount * extrasBase) / gross).toFixed(2);
    }

    if (discountScope === "ROOM") {
      discountAmount = +((roomBase * discountPercent) / 100).toFixed(2);
      discountedRoom -= discountAmount;
    }

    if (discountScope === "EXTRAS") {
      discountAmount = +((extrasBase * discountPercent) / 100).toFixed(2);
      discountedExtras -= discountAmount;
    }
  }

  discountedRoom = +discountedRoom.toFixed(2);
  discountedExtras = +discountedExtras.toFixed(2);

  /* ===================== TAXABLE (AFTER DISCOUNT ✅) ===================== */
  const taxable = +(discountedRoom + discountedExtras).toFixed(2);

  /* ===================== GST (AFTER DISCOUNT ✅) ===================== */
  const totalGST = booking.gstEnabled ? +(taxable * 0.05).toFixed(2) : 0;

  const cgst = +(totalGST / 2).toFixed(2);
  const sgst = +(totalGST / 2).toFixed(2);

  /* ===================== FOOD ===================== */
  const foodSummary = await getFoodSummary(booking._id);
  const foodTotal = Number(foodSummary?.total || 0);

  /* ===================== GRAND TOTAL ===================== */
  let grandTotal = taxable + totalGST + foodTotal;

  /* ===================== ROUND OFF ===================== */
  let roundOffAmount = 0;

  if (booking.roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    roundOffAmount = +(rounded - grandTotal).toFixed(2);
    grandTotal = rounded;
  }

  /* ===================== ADVANCES ===================== */
  const advancePaid = Array.isArray(booking.advances)
    ? booking.advances.reduce((sum, a) => sum + Number(a.amount || 0), 0)
    : 0;

  const balanceDue = Math.max(0, +(grandTotal - advancePaid).toFixed(2));
  // const balanceDue = +(grandTotal - advancePaid).toFixed(2);
  // const finalPaymentReceived = balanceDue <= 0;
  // /* ===================== ASSIGN ===================== */
  booking.roomBase = roomBase;
  booking.extrasBase = extrasBase;

  booking.discountAmount = discountAmount;
  booking.taxable = taxable;
  booking.cgst = cgst;
  booking.sgst = sgst;

  booking.roundOffAmount = roundOffAmount;
  booking.grandTotal = +grandTotal.toFixed(2);
  booking.advancePaid = advancePaid;
  booking.balanceDue = balanceDue;

  //   /* ===================== ASSIGN ===================== */
  // booking.roomBase = roomBase;
  // booking.extrasBase = extrasBase;

  // booking.discountAmount = discountAmount;
  // booking.taxable = taxable;
  // booking.cgst = cgst;
  // booking.sgst = sgst;

  // booking.roundOffAmount = roundOffAmount;
  // booking.grandTotal = +grandTotal.toFixed(2);

  // booking.advancePaid = advancePaid;
  // booking.balanceDue = balanceDue;
  // booking.finalPaymentReceived = finalPaymentReceived;
};

/**
 * createBooking
 *
 * payload:
 *  - hotel_id, room_id
 *  - checkIn (ISO datetime string) , checkOut (ISO datetime string)
 *  - gstEnabled (boolean)
 *  - planCode, adults, children
 *  - advancePaid (number)
 *  - discount (percentage number)
 *  - addedServices: [{ name, price, days?: [1,2,...] }]   // days optional => all nights
 *  - guestIds ...
 */
export const createBooking = async ({
  hotel_id,
  room_id,
  checkIn,
  checkOut,

  gstEnabled = true, // ROOM GST
  roundOffEnabled = true,
  roundOffAmount = 0,

  planCode,
  pricingMode,
  pricingType,
  finalRoomPrice,

  adults = 1,
  children = 0,
  // ✅ NEW
  advanceAmount = 0,
  advancePaymentMode = "CASH",
  advanceNote = "",
  // advancePaid = 0,
  // advancePaymentMode = "CASH",

  discount = 0,
  guestIds = [],
  addedServices = [], // now supports gstEnabled per service
  taxable = 0, // ✅ ADD
  //balanceDue = 0,

  ...rest
}) => {
  /* ---------------- VALIDATION ---------------- */

  const checkInDT = new Date(checkIn);
  const checkOutDT = new Date(checkOut);

  if (isNaN(checkInDT.getTime()) || isNaN(checkOutDT.getTime())) {
    throw new Error("Invalid checkIn/checkOut datetime");
  }

  if (checkInDT >= checkOutDT) {
    throw new Error("checkIn must be before checkOut");
  }

  /* ---------------- AVAILABILITY CHECK ---------------- */

  const overlapping = await RoomBooking.findOne({
    hotel_id,
    room_id,
    status: { $nin: ["CANCELLED"] },
    checkIn: { $lt: checkOutDT },
    checkOut: { $gt: checkInDT },
  });

  if (overlapping) {
    throw new Error("Room not available in selected dates/times");
  }

  /* ---------------- ROOM + PLAN ---------------- */

  const room = await Room.findById(room_id);
  if (!room) throw new Error("Room not found");

  const plan = room.plans.find(
    (p) =>
      p.code === planCode ||
      `${p.code}_SINGLE` === planCode ||
      `${p.code}_DOUBLE` === planCode,
  );

  if (!plan) throw new Error("Invalid plan selected");

  const isSingle = String(planCode).includes("SINGLE");
  const rate = isSingle ? plan.singlePrice : plan.doublePrice;

  /* ---------------- NIGHTS ---------------- */

  const rawDays = (checkOutDT.getTime() - checkInDT.getTime()) / MS_PER_DAY;

  const nights = Math.max(1, Math.ceil(rawDays));

  /* ---------------- ROOM TOTAL ---------------- */
  /* ---------------- ROOM TOTAL ---------------- */

  let roomBase = 0;
  let roomGSTFromRoom = 0;

  const isSpecialPricing =
    typeof rest.finalRoomPrice === "number" && rest.finalRoomPrice > 0;

  if (isSpecialPricing) {
    // finalRoomPrice = FINAL PRICE PER NIGHT (GST INCLUSIVE)
    const finalPerNight = Number(rest.finalRoomPrice);

    const basePerNight = +(finalPerNight / 1.05).toFixed(2);
    const gstPerNight = +(finalPerNight - basePerNight).toFixed(2);

    roomBase = +(basePerNight * nights).toFixed(2);
    roomGSTFromRoom = +(gstPerNight * nights).toFixed(2);
  } else {
    // OLD BEHAVIOUR (UNCHANGED)
    roomBase = +(rate * nights).toFixed(2);
  }

  /* ---------------- EXTRA SERVICES ---------------- */
  // BACKWARD COMPATIBLE:
  // - if gstEnabled missing on service → GST APPLIED
  let extrasBase = 0;
  let extrasGST = 0;

  addedServices.forEach((s) => {
    const price = Number(s.price || 0);

    const daysArray =
      Array.isArray(s.days) && s.days.length > 0
        ? s.days
        : Array.from({ length: nights }, (_, i) => i + 1);

    const uniqueDays = [...new Set(daysArray)].filter(
      (d) => d >= 1 && d <= nights,
    );

    const serviceAmount = price * uniqueDays.length;
    extrasBase += serviceAmount;

    const serviceGSTEnabled =
      s.gstEnabled === undefined ? true : Boolean(s.gstEnabled);

    if (serviceGSTEnabled && gstEnabled) {
      extrasGST += +(serviceAmount * 0.05).toFixed(2);
    }
  });

  /* ---------------- DISCOUNT (SCOPE AWARE) ---------------- */

  const discountPercent = Number(discount || 0);
  const discountScope = rest.discountScope || "TOTAL";

  let discountedRoomBase = roomBase;
  let discountedExtrasBase = extrasBase;
  let discountAmount = 0;

  if (discountPercent > 0) {
    if (discountScope === "TOTAL") {
      const gross = roomBase + extrasBase;
      discountAmount = +((gross * discountPercent) / 100).toFixed(2);

      discountedRoomBase -= +((discountAmount * roomBase) / gross).toFixed(2);
      discountedExtrasBase -= +((discountAmount * extrasBase) / gross).toFixed(
        2,
      );
    }

    if (discountScope === "ROOM") {
      discountAmount = +((roomBase * discountPercent) / 100).toFixed(2);
      discountedRoomBase -= discountAmount;
    }

    if (discountScope === "EXTRAS") {
      discountAmount = +((extrasBase * discountPercent) / 100).toFixed(2);
      discountedExtrasBase -= discountAmount;
    }
  }

  /* ---------------- GST (INDUSTRY CORRECT) ---------------- */

  let gstBase = 0;

  // 1️⃣ Room GST (after discount)
  // Room GST
  if (gstEnabled) {
    if (!isSpecialPricing) {
      gstBase += discountedRoomBase;
    }
  }

  // 2️⃣ Extra services GST (only GST-enabled services, after discount)
  if (gstEnabled) {
    addedServices.forEach((s) => {
      if (s.gstEnabled !== false) {
        const daysArray =
          Array.isArray(s.days) && s.days.length > 0
            ? s.days
            : Array.from({ length: nights }, (_, i) => i + 1);

        const originalServiceBase = s.price * daysArray.length;

        // Apply discount proportionally ONLY if extras had discount
        let discountedServiceBase = originalServiceBase;

        if (extrasBase > 0) {
          const discountRatio = discountedExtrasBase / extrasBase;
          discountedServiceBase = originalServiceBase * discountRatio;
        }

        gstBase += discountedServiceBase;
      }
    });
  }

  let totalGST = +(gstBase * 0.05).toFixed(2);
  if (isSpecialPricing) {
    totalGST += roomGSTFromRoom;
  }
  const cgst = +(totalGST / 2).toFixed(2);
  const sgst = +(totalGST / 2).toFixed(2);
  /* ---------------- ADVANCES (NEW ARRAY WAY) ---------------- */

  const advances = [];

  if (Number(advanceAmount) > 0) {
    advances.push({
      amount: Number(advanceAmount),
      mode: advancePaymentMode || "CASH",
      note: advanceNote || "Advance at booking",
      date: new Date(),
    });
  }

  const advancePaid = advances.reduce((sum, a) => sum + a.amount, 0);
  const taxableAmount = +(discountedRoomBase + discountedExtrasBase).toFixed(2);
  const totalGSTAmount = cgst + sgst;

  let grandTotal = taxableAmount + totalGSTAmount;

  if (roundOffEnabled) {
    grandTotal = Math.round(grandTotal);
  }

  const balanceDue = Math.max(+(grandTotal - advancePaid).toFixed(2), 0);

  /* ---------------- CREATE BOOKING ---------------- */

  const bookingPayload = {
    hotel_id,
    room_id,

    checkIn: checkInDT,
    checkOut: checkOutDT,

    guestName: rest.guestName,
    guestPhone: rest.guestPhone,
    guestEmail: rest.guestEmail,

    guestCity: rest.guestCity,
    guestNationality: rest.guestNationality,
    guestAddress: rest.guestAddress,

    companyName: rest.companyName,
    companyGSTIN: rest.companyGSTIN,
    companyAddress: rest.companyAddress,

    gstEnabled,
    roundOffEnabled,
    roundOffAmount,

    planCode,

    pricingMode: pricingMode || "PLAN",
    pricingType: pricingType || "BASE_EXCLUSIVE",
    finalRoomPrice: finalRoomPrice ?? null,
    adults,
    children,

    // advancePaid: Number(advancePaid || 0),
    // advancePaymentMode,

    advances, // ✅ ARRAY STORED
    advancePaid, // ✅ DERIVED
    balanceDue, // ✅ DERIVED

    discount: discountPercent,
    discountScope,
    discountAmount,

    taxable: +(discountedRoomBase + discountedExtrasBase).toFixed(2),
    cgst,
    sgst,

    addedServices,
    guestIds,

    grandTotal,
    notes: rest.notes,
  };

  const booking = await RoomBooking.create(bookingPayload);

  /* ---------------- UPDATE ROOM STATUS ---------------- */

  try {
    await Room.findByIdAndUpdate(room_id, { status: "OCCUPIED" });
  } catch (e) {
    console.warn("Room status update failed:", e.message);
  }

  return booking;
};
/**
 * checkoutBooking
 *
 * - bookingId: string
 * - userId: who performs checkout (not currently used except maybe for logs)
 *
 * Behavior:
 * - uses actual checkout time (Date.now()) — this represents the real time the guest left
 * - calculates nights from booking.checkIn to actualCheckoutTime
 * - applies discount ONLY to stay charges (stay + stayGST)
 * - includes food orders (paymentStatus:PENDING && status:DELIVERED) in invoice, marks them PAID
 * - creates RoomInvoice, updates booking (CHECKEDOUT), frees room, creates transaction
 */
// bookingService.js - Fixed checkoutBooking function
/*v1*/
// export const checkoutBooking = async (
//   bookingId,
//   userId,
//   finalPaymentData = {},
// ) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // Get booking with full room details
//     const booking = await RoomBooking.findById(bookingId)
//       .populate("room_id")
//       .session(session);

//     if (!booking) throw new Error("Booking not found");

//     const room = booking.room_id;
//     if (!room) throw new Error("Room not found");

//     // ========================================
//     // ACTUAL CHECKOUT TIME
//     // ========================================
//     const actualCheckoutTime = new Date();

//     // ========================================
//     // CALCULATE NIGHTS (using actual checkout)
//     // ========================================
//     const checkInDT = new Date(booking.checkIn);
//     const checkOutDT = new Date(booking.checkOut); // Use booking's checkOut (which may have been edited)
//     const MS_PER_DAY = 1000 * 60 * 60 * 24;
//     const rawDays = (checkOutDT.getTime() - checkInDT.getTime()) / MS_PER_DAY;
//     const nights = Math.max(1, Math.ceil(rawDays));

//     // ========================================
//     // ROOM RATE (from current booking)
//     // ========================================
//     const plan = room.plans.find(
//       (p) =>
//         `${p.code}_SINGLE` === booking.planCode ||
//         `${p.code}_DOUBLE` === booking.planCode,
//     );
//     if (!plan) throw new Error("Invalid plan");

//     const roomRate = String(booking.planCode).includes("SINGLE")
//       ? plan.singlePrice
//       : plan.doublePrice;

//     // ========================================
//     // ROOM STAY AMOUNT
//     // ========================================
//     const stayAmount = +(roomRate * nights).toFixed(2);

//     // ========================================
//     // EXTRA SERVICES (from current booking.addedServices)
//     // ========================================
//     const extraServices = (booking.addedServices || []).map((ex) => {
//       const price = Number(ex.price || 0);
//       const daysArray =
//         Array.isArray(ex.days) && ex.days.length > 0
//           ? ex.days
//           : Array.from({ length: nights }, (_, i) => i + 1);

//       const uniqueDays = [...new Set(daysArray)].filter(
//         (d) => d >= 1 && d <= nights,
//       );

//       return {
//         name: ex.name,
//         price: ex.price,
//         gstEnabled: ex.gstEnabled !== false, // default true
//         days: uniqueDays,
//       };
//     });

//     // Calculate extras total
//     const extrasBase = extraServices.reduce((sum, ex) => {
//       return sum + ex.price * ex.days.length;
//     }, 0);

//     const extrasGST = extraServices.reduce((sum, ex) => {
//       if (ex.gstEnabled) {
//         const base = ex.price * ex.days.length;
//         return sum + base * 0.05;
//       }
//       return sum;
//     }, 0);

//     const roomBase = stayAmount + extrasBase;

//     // ========================================
//     // ROOM GST (use booking.gstEnabled)
//     // ========================================
//     let stayCGST = 0;
//     let staySGST = 0;
//     let stayGST = 0;

//     if (booking.gstEnabled) {
//       const roomGST = +(stayAmount * 0.05).toFixed(2);
//       stayCGST = +(roomGST / 2 + extrasGST / 2).toFixed(2);
//       staySGST = +(roomGST / 2 + extrasGST / 2).toFixed(2);
//       stayGST = +(stayCGST + staySGST).toFixed(2);
//     }

//     const roomGross = roomBase + stayGST;

//     // ========================================
//     // ROOM DISCOUNT (use booking.discount)
//     // ========================================
//     const discountPercent = Number(booking.discount || 0);
//     const discountAmount = +((roomGross * discountPercent) / 100).toFixed(2);
//     const roomNet = roomGross - discountAmount;

//     // ================= FOOD ORDERS =================
//     const foodOrders = await Order.find({
//       booking_id: booking._id,
//       room_id: booking.room_id,
//       hotel_id: booking.hotel_id,
//       paymentStatus: "PENDING",
//       status: "DELIVERED",
//       createdAt: { $gte: booking.checkIn, $lt: booking.checkOut },
//     }).session(session);

//     // Base subtotal (no GST)
//     const foodSubtotalRaw = foodOrders.reduce(
//       (s, o) => s + Number(o.subtotal || 0),
//       0,
//     );

//     // Discount BEFORE GST
//     const foodDiscountPercent = Number(booking.foodDiscount || 0);
//     const foodDiscountAmount = +(
//       (foodSubtotalRaw * foodDiscountPercent) /
//       100
//     ).toFixed(2);
//     const foodSubtotalAfterDiscount = +(
//       foodSubtotalRaw - foodDiscountAmount
//     ).toFixed(2);

//     // GST AFTER discount
//     let foodGST = 0;
//     if (booking.foodGSTEnabled) {
//       foodGST = +(foodSubtotalAfterDiscount * 0.05).toFixed(2);
//     }

//     const foodCGST = +(foodGST / 2).toFixed(2);
//     const foodSGST = +(foodGST / 2).toFixed(2);
//     const foodTotal = +(foodSubtotalAfterDiscount + foodGST).toFixed(2);

//     // ========================================
//     // FINAL TOTAL
//     // ========================================
//     const grandTotal = +(roomNet + foodTotal).toFixed(2);
//     const advancePaid = Number(booking.advancePaid || 0);
//     let balanceDue = +(grandTotal - advancePaid).toFixed(2);

//     // ========================================
//     // FINAL PAYMENT HANDLING
//     // ========================================
//     if (finalPaymentData.finalPaymentReceived) {
//       booking.finalPaymentReceived = true;
//       booking.finalPaymentMode = finalPaymentData.finalPaymentMode || "CASH";
//       booking.finalPaymentAmount = balanceDue;
//       balanceDue = 0;
//     }

//     const invoiceNumber = "ROOM-" + Date.now();

//     // ========================================
//     // CREATE INVOICE (store complete snapshot)
//     // ========================================
//     const invoicePayload = {
//       hotel_id: booking.hotel_id,
//       bookingId: booking._id,
//       room_id: room._id,
//       roomNumber: room.number,
//       roomType: room.type,
//       invoiceNumber,

//       // Guest info
//       guestName: booking.guestName,
//       guestPhone: booking.guestPhone,
//       guestCity: booking.guestCity,
//       guestNationality: booking.guestNationality,
//       guestAddress: booking.guestAddress,
//       adults: booking.adults,
//       children: booking.children,
//       guestIds: booking.guestIds || [],

//       // Company info
//       companyName: booking.companyName,
//       companyGSTIN: booking.companyGSTIN,
//       companyAddress: booking.companyAddress,

//       // Stay details
//       checkIn: booking.checkIn,
//       checkOut: booking.checkOut,
//       stayNights: nights,
//       planCode: booking.planCode,
//       pricingType: booking.pricingType,
// finalRoomPrice: booking.finalRoomPrice,

// // 🔒 TAX SNAPSHOT (BACKEND TRUTH)
// taxable: booking.taxable,
// cgst: booking.cgst,
// sgst: booking.sgst,

//       // Room charges
//       roomRate,
//       stayAmount,
//       extraServices,

//       // Room GST
//       stayCGST,
//       staySGST,
//       stayGST,
//       gstEnabled: booking.gstEnabled,

//       // Room discount
//       discountPercent,
//       discountAmount,
//       roomGross,
//       roomNet,

//       // Food orders
//       foodOrders: foodOrders.map((o) => ({
//         order_id: o._id,
//         items: o.items,
//         subtotal: o.subtotal,
//         gst: o.gst,
//         total: o.total,
//       })),

//       foodSubtotalRaw,
//       foodDiscountPercent,
//       foodDiscountAmount,
//       foodSubtotalAfterDiscount,
//       foodCGST,
//       foodSGST,
//       foodGST,
//       foodTotal,
//       foodGSTEnabled: booking.foodGSTEnabled,

//       // Final amounts
//       grandTotal,
//       totalAmount: grandTotal, // Keep both for compatibility
//       advancePaid,
//       balanceDue,

//       // Payment details
//       advancePaymentMode: booking.advancePaymentMode,
//       finalPaymentMode: booking.finalPaymentMode,
//       finalPaymentReceived: booking.finalPaymentReceived,
//       finalPaymentAmount: booking.finalPaymentAmount,

//       actualCheckoutTime,
//     };
//     // console.log("CHECKOUT guestIds:", booking.guestIds);

//     const invoice = await RoomInvoice.create([invoicePayload], { session });

//     // ========================================
//     // MARK FOOD ORDERS AS PAID
//     // ========================================
//     if (foodOrders.length > 0) {
//       await Order.updateMany(
//         { _id: { $in: foodOrders.map((o) => o._id) } },
//         { paymentStatus: "PAID", paidAt: checkOutDT },
//         { session },
//       );
//     }

//     // ========================================
//     // UPDATE BOOKING STATUS
//     // ========================================
//     booking.status = "CHECKEDOUT";
//     booking.balanceDue = balanceDue;
//     booking.actualCheckoutTime = actualCheckoutTime; // Store actual checkout time
//     await booking.save({ session });

//     // ========================================
//     // RELEASE ROOM
//     // ========================================
//     await Room.findByIdAndUpdate(booking.room_id, {
//       status: "AVAILABLE",
//     }).session(session);

//     // ========================================
//     // CREATE TRANSACTION
//     // ========================================
//     await transactionService.createTransaction(booking.hotel_id, {
//       type: "CREDIT",
//       source: "ROOM",
//       amount: grandTotal,
//       referenceId: invoice[0]._id,
//       description: `Room + Food invoice for Room ${room.number}`,
//     });

//     await session.commitTransaction();
//     session.endSession();

//     return invoice[0].toObject();
//   } catch (e) {
//     await session.abortTransaction();
//     session.endSession();
//     throw e;
//   }
// };
/*v2 */
export const checkoutBooking = async (
  bookingId,
  userId,
  finalPaymentData = {},
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /* ===================== FETCH BOOKING ===================== */
    const booking = await RoomBooking.findById(bookingId)
      .populate("room_id")
      .session(session);

    if (!booking) throw new Error("Booking not found");
    if (!booking.room_id) throw new Error("Room not found");

    /* ===================== RE-CALCULATE (NEW LOGIC) ===================== */
    await recalculatePayments(booking);
    /* ===================== FIX TAXABLE SNAPSHOT ===================== */
    // Ensure taxable = room + extras (post recalculation)
    const finalTaxable =
      Number(booking.roomBase || 0) +
      Number(booking.extrasBase || 0) -
      Number(booking.discountAmount || 0);

    // Overwrite booking snapshot fields (invoice truth)
    booking.taxable = +finalTaxable.toFixed(2);
    booking.cgst = +(finalTaxable * 0.025).toFixed(2);
    booking.sgst = +(finalTaxable * 0.025).toFixed(2);

    /* ===================== ACTUAL CHECKOUT TIME ===================== */
    const actualCheckoutTime = new Date();

    /* ===================== FOOD ORDERS ===================== */
    const foodOrders = await Order.find({
      booking_id: booking._id,
      room_id: booking.room_id._id,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
      status: "DELIVERED",
    }).session(session);

    const foodSubtotalRaw = foodOrders.reduce(
  (sum, o) => sum + Number(o.subtotal || 0),
  0
);

const foodDiscountPercent = Number(booking.foodDiscount || 0);
const foodDiscountAmount = +(
  (foodSubtotalRaw * foodDiscountPercent) / 100
).toFixed(2);

const foodSubtotalAfterDiscount = +(
  foodSubtotalRaw - foodDiscountAmount
).toFixed(2);

let foodGST = 0;
if (booking.foodGSTEnabled) {
  foodGST = +(foodSubtotalAfterDiscount * 0.05).toFixed(2);
}

const foodCGST = +(foodGST / 2).toFixed(2);
const foodSGST = +(foodGST / 2).toFixed(2);
const foodTotal = +(foodSubtotalAfterDiscount + foodGST).toFixed(2);


    /* ===================== FINAL PAYMENT ===================== */
    if (finalPaymentData?.finalPaymentReceived) {
      booking.finalPaymentReceived = true;
      booking.finalPaymentMode = finalPaymentData.finalPaymentMode || "CASH";
      booking.finalPaymentAmount = booking.balanceDue;
      booking.balanceDue = 0;
    }
    /* ===================== ROOM RATE (ACCOUNTING-CORRECT) ===================== */
    let roomRate = 0; // always EX-GST per night

    if (
      booking.pricingType === "FINAL_INCLUSIVE" &&
      Number(booking.finalRoomPrice) > 0
    ) {
      // finalRoomPrice = per-night GST inclusive
      const { base } = splitGST(Number(booking.finalRoomPrice));
      roomRate = base; // ✅ per-night EX-GST
    } else if (booking.room_id?.plans?.length && booking.planCode) {
      const [planCode, occupancy] = booking.planCode.split("_");
      const plan = booking.room_id.plans.find((p) => p.code === planCode);
      if (plan) {
        roomRate = occupancy === "SINGLE" ? plan.singlePrice : plan.doublePrice;
      }
    }

    if (!roomRate) {
      roomRate = booking.room_id?.baseRate || 0;
    }

    roomRate = +roomRate.toFixed(2);

    const invoiceNumber = `ROOM-${Date.now()}`;

    /* ===================== INVOICE (OLD + NEW FIELDS) ===================== */
    const invoicePayload = {
      hotel_id: booking.hotel_id,
      bookingId: booking._id,
      room_id: booking.room_id._id,
      roomNumber: booking.room_id.number,
      roomType: booking.room_id.type,
      invoiceNumber,

      /* ---------- Guest (OLD) ---------- */
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guestCity: booking.guestCity,
      guestNationality: booking.guestNationality,
      guestAddress: booking.guestAddress,
      adults: booking.adults,
      children: booking.children,
      guestIds: booking.guestIds || [],

      /* ---------- Company (OLD) ---------- */
      companyName: booking.companyName,
      companyGSTIN: booking.companyGSTIN,
      companyAddress: booking.companyAddress,

      /* ---------- Stay (OLD) ---------- */
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      stayNights: booking.nights,
      planCode: booking.planCode,

      /* =======================================================
         🧱 LEGACY BILLING FIELDS (DO NOT REMOVE)
         ======================================================= */
      roomRate,
      stayAmount: booking.stayAmount || booking.roomBase || 0,
      roomGross:
        booking.roomGross || booking.taxable + booking.cgst + booking.sgst,
      roomNet: booking.roomNet || booking.taxable + booking.cgst + booking.sgst,

      stayCGST: booking.stayCGST || booking.cgst || 0,
      staySGST: booking.staySGST || booking.sgst || 0,
      stayGST: booking.stayGST || booking.cgst + booking.sgst || 0,

      discountPercent: booking.discount || 0,
      discountAmount: booking.discountAmount || 0,

      /* =======================================================
         🆕 NEW FINAL-INCLUSIVE SNAPSHOT (ADDITIVE ONLY)
         ======================================================= */
      pricingType: booking.pricingType,
      finalRoomPrice: booking.finalRoomPrice,

      roomBase: booking.roomBase,
      extraServices: booking.addedServices || [],
      extrasBase: booking.extrasBase,

      taxable: booking.taxable,
      cgst: booking.cgst,
      sgst: booking.sgst,

      roundOffAmount: booking.roundOffAmount,

      /* ---------- Food (OLD + NEW) ---------- */
foodOrders: foodOrders.map((o) => ({
        order_id: o._id,
        items: o.items,
        subtotal: o.subtotal,
        gst: o.gst,
        total: o.total,
      })),

      foodSubtotalRaw,
      foodDiscountPercent,
      foodDiscountAmount,
      foodSubtotalAfterDiscount,
      foodCGST,
      foodSGST,
      foodGST,
      foodTotal,
      foodGSTEnabled: booking.foodGSTEnabled,

      /* ---------- Final ---------- */
      grandTotal: booking.grandTotal,
      totalAmount: booking.grandTotal, // backward compatibility
      advancePaid: booking.advancePaid,
      balanceDue: booking.balanceDue,

      /* ---------- Payment ---------- */
      advancePaymentMode: booking.advancePaymentMode,
      finalPaymentMode: booking.finalPaymentMode,
      finalPaymentReceived: booking.finalPaymentReceived,
      finalPaymentAmount: booking.finalPaymentAmount,

      actualCheckoutTime,
    };
    console.log({
      roomBase: booking.roomBase,
      extrasBase: booking.extrasBase,
      taxable: booking.taxable,
      cgst: booking.cgst,
      sgst: booking.sgst,
    });

    const invoice = await RoomInvoice.create([invoicePayload], { session });

    /* ===================== MARK FOOD ORDERS PAID ===================== */
    if (foodOrders.length) {
      await Order.updateMany(
        { _id: { $in: foodOrders.map((o) => o._id) } },
        { paymentStatus: "PAID", paidAt: actualCheckoutTime },
        { session },
      );
    }

    /* ===================== CLOSE BOOKING ===================== */
    booking.status = "CHECKEDOUT";
    booking.actualCheckoutTime = actualCheckoutTime;
    await booking.save({ session });

    /* ===================== RELEASE ROOM ===================== */
    await Room.findByIdAndUpdate(
      booking.room_id._id,
      { status: "AVAILABLE" },
      { session },
    );

    /* ===================== TRANSACTION ===================== */
    await transactionService.createTransaction(
      booking.hotel_id,
      {
        type: "CREDIT",
        source: "ROOM",
        amount: booking.grandTotal,
        referenceId: invoice[0]._id,
        description: `Room + Food invoice for Room ${booking.room_id.number}`,
      },
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return invoice[0].toObject();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getFoodOrdersForBooking = async (booking) => {
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  return Order.find({
    room_id: booking.room_id,
    hotel_id: booking.hotel_id,
    status: "DELIVERED", // or include NEW/PREPARING if you want live orders
    createdAt: { $gte: checkIn, $lt: checkOut },
  });
};
