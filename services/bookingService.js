// services/bookingService.js
import mongoose from "mongoose";
import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import RoomInvoice from "../models/RoomInvoice.js";
import Order from "../models/Order.js";
import * as transactionService from "./transactionService.js"; // adjust path if needed

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
  gstEnabled = true,
  planCode,
  adults = 1,
  children = 0,
  advancePaid = 0,
  advancePaymentMode = "CASH",
  discount = 0,
  guestIds = [],
  addedServices = [],
  ...rest
}) => {
  // normalize inputs
  const checkInDT = new Date(checkIn);
  const checkOutDT = new Date(checkOut);

  if (isNaN(checkInDT.getTime()) || isNaN(checkOutDT.getTime())) {
    throw new Error("Invalid checkIn/checkOut datetime");
  }
  if (checkInDT >= checkOutDT) {
    throw new Error("checkIn must be before checkOut");
  }

  // 1) Availability check (overlap in datetime)
  // Overlap if: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
  const overlapping = await RoomBooking.findOne({
    hotel_id,
    room_id,
    status: { $nin: ["CANCELLED"] },
    checkIn: { $lt: checkOutDT },
    checkOut: { $gt: checkInDT }
  });

  if (overlapping) {
    // If overlapping exists, it blocks booking (because some booking still occupies at the requested time)
    throw new Error("Room not available in selected dates/times");
  }

  // 2) Load room and plan
  const room = await Room.findById(room_id);
  if (!room) throw new Error("Room not found");

  const plan = room.plans.find(p =>
    p.code === planCode || `${p.code}_SINGLE` === planCode || `${p.code}_DOUBLE` === planCode
  );
  if (!plan) throw new Error("Invalid plan selected");

  const isSingle = String(planCode).includes("SINGLE");
  const rate = isSingle ? plan.singlePrice : plan.doublePrice;

  // 3) Nights calculation: treat full-day blocks from checkIn to checkOut
  // nights = ceil((checkOut - checkIn) / 1 day), minimum 1
  const rawDays = (checkOutDT.getTime() - checkInDT.getTime()) / MS_PER_DAY;
  const nights = Math.max(1, Math.ceil(rawDays));

  // 4) Room total (rate * nights)
  const roomTotal = +(rate * nights).toFixed(2);

  // 5) Extras total: each extra can specify `days` (array of day indexes 1..n). If absent -> assume all nights.
  // e.g. addedServices = [{ name, price, days: [1] }] => only day1 charged
  const extrasTotal = addedServices.reduce((sum, s) => {
    const price = Number(s.price || 0);
    const daysArray = Array.isArray(s.days) && s.days.length > 0 ? s.days : Array.from({ length: nights }, (_, i) => i + 1);
    // number of charged days equals unique days in daysArray but bounded by nights
    const uniqueDays = [...new Set(daysArray)].filter(d => d >= 1 && d <= nights);
    return sum + price * uniqueDays.length;
  }, 0);

  const baseTotal = +(roomTotal + extrasTotal).toFixed(2);

  // 6) Discount (percentage)
  const discountPercent = Number(discount || 0);
  const discountAmount = +((baseTotal * discountPercent) / 100).toFixed(2);

  // 7) Taxable (after discount)
  const taxable = +(baseTotal - discountAmount).toFixed(2);

  // 8) GST split (if enabled) — CGST & SGST each 2.5% (total 5%)
  let cgst = 0;
  let sgst = 0;
  if (gstEnabled) {
    cgst = +(taxable * 0.025).toFixed(2);
    sgst = +(taxable * 0.025).toFixed(2);
  }

  const finalTotal = +(taxable + cgst + sgst).toFixed(2);
  const balanceDue = Math.max(0, +(finalTotal - Number(advancePaid || 0)).toFixed(2));
  advancePaymentMode = rest.advancePaymentMode || advancePaymentMode;

  // 9) Create booking
  const bookingPayload = {
    hotel_id,
    room_id,
    checkIn: checkInDT,
    checkOut: checkOutDT,
    gstEnabled,
    planCode,
    adults,
    children,
    advancePaid: Number(advancePaid || 0),
    advancePaymentMode,
    discount: discountPercent,
    discountAmount,
    taxable,
    cgst,
    sgst,
    addedServices,
    balanceDue,
    guestIds,
    ...rest
  };

  const booking = await RoomBooking.create(bookingPayload);

  // 10) Mark room OCCUPIED (current state)
  try {
    await Room.findByIdAndUpdate(room_id, { status: "OCCUPIED" });
  } catch (e) {
    // non-fatal
    console.warn("Failed to update room status after booking:", e.message);
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
export const checkoutBooking = async (bookingId, userId, finalPaymentData = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await RoomBooking.findById(bookingId).session(session);
    if (!booking) throw new Error("Booking not found");

    const room = await Room.findById(booking.room_id).session(session);
    if (!room) throw new Error("Room not found");

    // actual checkout time: use current time (server now)
    const actualCheckoutTime = new Date();

    // Determine plan & rate
    const plan = room.plans.find(p =>
      `${p.code}_SINGLE` === booking.planCode || `${p.code}_DOUBLE` === booking.planCode
    );
    if (!plan) throw new Error("Invalid plan");

    const rate = String(booking.planCode).includes("SINGLE") ? plan.singlePrice : plan.doublePrice;

    // Calculate nights using actual checkout time
    const checkInDT = new Date(booking.checkIn);
    const rawDays = (actualCheckoutTime.getTime() - checkInDT.getTime()) / MS_PER_DAY;
    const nights = Math.max(1, Math.ceil(rawDays));

    // Stay amount (rate * nights)
    const stayAmount = +(rate * nights).toFixed(2);

    // Extra services: compute based on booking.addedServices days array (bounded by nights)
    const extraTotal = (booking.addedServices || []).reduce((s, ex) => {
      const price = Number(ex.price || 0);
      const daysArray = Array.isArray(ex.days) && ex.days.length > 0 ? ex.days : Array.from({ length: nights }, (_, i) => i + 1);
      const uniqueDays = [...new Set(daysArray)].filter(d => d >= 1 && d <= nights);
      return s + price * uniqueDays.length;
    }, 0);

    const stayTotal = +(stayAmount + extraTotal).toFixed(2);

    // GST on stayTotal if booking.gstEnabled
    let stayCGST = 0;
    let staySGST = 0;
    let stayGST = 0;
    if (booking.gstEnabled) {
      stayCGST = +(stayTotal * 0.025).toFixed(2);
      staySGST = +(stayTotal * 0.025).toFixed(2);
      stayGST = +(stayCGST + staySGST).toFixed(2);
    }

    // 2) Food orders that belong to this room and are delivered but pending payment
    const foodOrders = await Order.find({
      room_id: booking.room_id,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
      status: "DELIVERED"
    }).session(session);

    const foodSubtotal = foodOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const foodGST = foodOrders.reduce((s, o) => s + Number(o.gst || 0), 0);
    const foodTotal = +(foodSubtotal + foodGST).toFixed(2);

    // 3) Apply discount ONLY on room (stayTotal + stayGST)
    const discountPercent = Number(booking.discount || 0);
    const discountBase = +(stayTotal + stayGST).toFixed(2);
    const discountAmount = +((discountBase * discountPercent) / 100).toFixed(2);

    // Final amount = (room after discount) + food total
    const finalRoomAfterDiscount = +(discountBase - discountAmount).toFixed(2);
    const finalAmount = +(finalRoomAfterDiscount + foodTotal).toFixed(2);

    // Remaining balance considering advancePaid on booking
    const balanceDue = +(finalAmount - (booking.advancePaid || 0)).toFixed(2);

    let updatedBalance = balanceDue;

    if (finalPaymentData.finalPaymentReceived) {
      updatedBalance = 0;

      booking.finalPaymentReceived = true;
      booking.finalPaymentMode =
        finalPaymentData.finalPaymentMode || "CASH";

      // Auto-pay full remaining balance
      booking.finalPaymentAmount = balanceDue;
    }


    const invoiceNumber = "ROOM-" + Date.now();

    // 4) Create invoice document (inside session)
    const invoicePayload = {
      hotel_id: booking.hotel_id,
      bookingId: booking._id,
      room_id: room._id,
      roomNumber: room.number, 
      invoiceNumber,

      guestName: booking.guestName,
      guestPhone: booking.guestPhone,

      stayNights: nights,
      roomRate: rate,
      stayAmount,
      extraServices: booking.addedServices || [],

      stayCGST,
      staySGST,
      stayGST,

      gstEnabled: booking.gstEnabled,

      foodOrders: foodOrders.map(o => ({
        order_id: o._id,
        items: o.items,
        subtotal: o.subtotal,
        gst: o.gst,
        total: o.total
      })),

      foodSubtotal,
      foodGST,
      foodTotal,

      discountPercent,
      discountAmount,

      totalAmount: finalAmount,
      advancePaid: booking.advancePaid,
      balanceDue: updatedBalance,

      advancePaymentMode: booking.advancePaymentMode, 
      finalPaymentMode: booking.finalPaymentMode,     
      finalPaymentReceived: booking.finalPaymentReceived,
      finalPaymentAmount: booking.finalPaymentAmount,

      actualCheckoutTime
    };

    const invoice = await RoomInvoice.create([invoicePayload], { session });

    // 5) Mark food orders as PAID
    if (foodOrders.length > 0) {
      await Order.updateMany(
        { _id: { $in: foodOrders.map(o => o._id) } },
        { paymentStatus: "PAID" },
        { session }
      );
    }

    // 6) Update booking: status + balanceDue + actual checkOut (store actual check out to booking.checkOut so record shows actual)
    booking.status = "CHECKEDOUT";
    booking.balanceDue = updatedBalance;
    booking.checkOut = actualCheckoutTime; // store real checkout on booking for record (important)
    await booking.save({ session });

    // 7) Release room
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" }).session(session);

    // 8) Create transaction entry for hotel ledger
    await transactionService.createTransaction(booking.hotel_id, {
      type: "CREDIT",
      source: "ROOM",
      amount: finalAmount,
      referenceId: invoice[0]._id,
      description: `Room + Food invoice for Room ${room.number}`
    });

    await session.commitTransaction();
    session.endSession();

    // return invoice object
    return invoice[0];

  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
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
