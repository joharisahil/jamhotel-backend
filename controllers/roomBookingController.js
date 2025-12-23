// controllers/roomBookingController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as bookingService from "../services/bookingService.js";
import * as roomService from "../services/roomService.js";
import RoomBooking from "../models/RoomBooking.js";
import RoomInvoice from "../models/RoomInvoice.js";
import Room from "../models/Room.js";
import Order from "../models/Order.js";

/**
 * CREATE BOOKING (Front Office)
 * Now supports:
 *  ✔ datetime check-in & check-out
 *  ✔ gstEnabled
 *  ✔ per-day extras
 *  ✔ returns discountAmount
 */
export const createBooking = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const payload = req.body;

  const booking = await bookingService.createBooking({
    hotel_id,
    ...payload,
  });

  res.status(201).json({
    success: true,
    booking,
  });
});

/**
 * GET SINGLE BOOKING
 */
export const getBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  res.json({ success: true, booking });
});

export const updateGuestInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    guestName,
    guestPhone,
    guestCity,
    guestNationality,
    guestAddress,
    adults,
    children
  } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.guestName = guestName;
  booking.guestPhone = guestPhone;
  booking.guestCity = guestCity;
  booking.guestNationality = guestNationality;
  booking.guestAddress = guestAddress;
  booking.adults = adults;
  booking.children = children;

  await booking.save();

  res.json({ success: true, booking });
});

export const updateGuestIds = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { guestIds } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.guestIds = Array.isArray(guestIds) ? guestIds : [];
  await booking.save();

  res.json({ success: true, booking });
});

export const updateCompanyDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { companyName, companyGSTIN, companyAddress } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.companyName = companyName;
  booking.companyGSTIN = companyGSTIN;
  booking.companyAddress = companyAddress;

  await booking.save();

  res.json({ success: true, booking });
});

export const reduceStay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newCheckOut } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  const oldCheckOut = new Date(booking.checkOut);
  const newCheckOutDT = new Date(newCheckOut);

  if (isNaN(newCheckOutDT.getTime()))
    return res.status(400).json({ success: false, message: "Invalid checkout date" });

  if (newCheckOutDT <= new Date(booking.checkIn))
    return res.status(400).json({ success: false, message: "Checkout must be after check-in" });

  if (newCheckOutDT >= oldCheckOut)
    return res.status(400).json({ success: false, message: "New checkout must be earlier than current checkout" });

  // ---------- Recalculate nights ----------
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const nights = Math.max(
    1,
    Math.ceil((newCheckOutDT - new Date(booking.checkIn)) / MS_PER_DAY)
  );

  // ---------- Room rate ----------
  const plan = booking.room_id.plans.find(p =>
    booking.planCode.startsWith(p.code)
  );
  if (!plan)
    return res.status(400).json({ success: false, message: "Invalid room plan" });

  const isSingle = booking.planCode.includes("SINGLE");
  const rate = isSingle ? plan.singlePrice : plan.doublePrice;

  const roomBase = +(rate * nights).toFixed(2);

  // ---------- Extra services ----------
  let extrasBase = 0;
  let extrasGST = 0;

  (booking.addedServices || []).forEach(s => {
    const price = Number(s.price || 0);
    const days = Array.isArray(s.days) && s.days.length > 0
      ? s.days.filter(d => d >= 1 && d <= nights)
      : Array.from({ length: nights }, (_, i) => i + 1);

    const base = price * days.length;
    extrasBase += base;

    if (booking.gstEnabled && s.gstEnabled !== false) {
      extrasGST += +(base * 0.05).toFixed(2);
    }
  });

  // ---------- Discount ----------
  const discountPercent = booking.discount || 0;
  const grossBase = roomBase + extrasBase;
  const discountAmount = +((grossBase * discountPercent) / 100).toFixed(2);

  const discountedBase = +(grossBase - discountAmount).toFixed(2);

  // ---------- GST ----------
  let totalGST = 0;
  if (booking.gstEnabled) {
    totalGST = +((discountedBase) * 0.05).toFixed(2);
  }

  const cgst = +(totalGST / 2).toFixed(2);
  const sgst = +(totalGST / 2).toFixed(2);

  const taxable = discountedBase;
  const total = +(taxable + totalGST).toFixed(2);

  // ---------- Balance ----------
  const foodTotal = booking.foodTotals?.total || 0;
  booking.balanceDue = +(total + foodTotal - booking.advancePaid).toFixed(2);

  // ---------- Persist ----------
  booking.checkOut = newCheckOutDT;
  booking.taxable = taxable;
  booking.cgst = cgst;
  booking.sgst = sgst;
  booking.discountAmount = discountAmount;

  await booking.save();

  res.json({
    success: true,
    message: "Stay reduced successfully",
    booking
  });
});

/**
 * LIST BOOKINGS
 */
export const listBookings = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { status, from, to, page = 1, limit = 50 } = req.query;

  const q = { hotel_id };
  if (status) q.status = status;

  if (from || to) {
    q.checkIn = {};
    if (from) q.checkIn.$gte = new Date(from);
    if (to) q.checkIn.$lte = new Date(to);
  }

  const bookings = await RoomBooking.find(q)
    .populate("room_id")
    .sort({ checkIn: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, bookings });
});

/**
 * CHECKOUT BOOKING — uses actual checkout time
 */
export const checkoutBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const invoice = await bookingService.checkoutBooking(id, req.user._id, req.body);

  res.json({ success: true, invoice });
});

/**
 * CANCEL BOOKING
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  booking.status = "CANCELLED";
  await booking.save();

  try {
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" });
  } catch (e) { }

  res.json({ success: true, booking });
});

/**
 * CURRENT BOOKING FOR A ROOM
 */
export const getCurrentBookingForRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const now = new Date();

  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: req.params.roomId,
    status: { $nin: ["CANCELLED", "CHECKEDOUT"] },
    checkIn: { $lte: now },
    checkOut: { $gt: now }
  }).populate("room_id");

  res.json({ success: true, booking: booking || null });
});

export const getBookingByDate = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { roomId, checkIn, checkOut } = req.query;

  if (!roomId || !checkIn || !checkOut)
    return res.status(400).json({ success: false, message: "Missing parameters" });

  const reqIn = new Date(checkIn);
  const reqOut = new Date(checkOut);
  const now = new Date();

  const booking = await RoomBooking.findOne({
    hotel_id,
    room_id: roomId,
    status: { $nin: ["CANCELLED"] },
    checkIn: { $lt: reqOut },
    checkOut: { $gt: reqIn }
  }).populate("room_id");

  if (!booking) {
    return res.json({ success: true, booking: null });
  }

  // ❗ HARD FIX: if booking is already CHECKEDOUT AND checkout time < NOW → DO NOT BLOCK
  if (booking.status === "CHECKEDOUT" && new Date(booking.checkOut) <= now) {
    return res.json({ success: true, booking: null });
  }

  // ❗ SAME-DAY CHECKOUT RULE:
  // if booking ends today AND checkout < now → treat as free
  const checkoutDT = new Date(booking.checkOut);
  const sameDay =
    checkoutDT.getFullYear() === reqIn.getFullYear() &&
    checkoutDT.getMonth() === reqIn.getMonth() &&
    checkoutDT.getDate() === reqIn.getDate();

  if (sameDay && checkoutDT <= now) {
    return res.json({ success: true, booking: null });
  }

  return res.json({ success: true, booking });
});

/**
 * ROOM INVOICES
 */
export const getInvoicesByRoom = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const invoices = await RoomInvoice.find({
    hotel_id,
    room_id: req.params.roomId,
  }).sort({ createdAt: -1 });

  res.json({ success: true, invoices });
});

/**
 * CHANGE ROOM — supports transfer of pending food orders
 */
export const changeRoom = asyncHandler(async (req, res) => {
  const { id } = req.params; // booking ID
  const { newRoomId } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  const oldRoomId = booking.room_id._id;

  const newRoom = await Room.findById(newRoomId);
  if (!newRoom)
    return res.status(404).json({ success: false, message: "New room not found" });

  if (newRoom.type !== booking.room_id.type)
    return res.status(400).json({
      success: false,
      message: "Room change allowed only within same room type",
    });

  if (newRoom.status !== "AVAILABLE")
    return res.status(400).json({
      success: false,
      message: "Selected room is not available",
    });

  booking.room_id = newRoomId;
  await booking.save();

  await Room.findByIdAndUpdate(oldRoomId, { status: "AVAILABLE" });
  await Room.findByIdAndUpdate(newRoomId, { status: "OCCUPIED" });

  // Move all pending unpaid food orders
  await Order.updateMany(
    {
      room_id: oldRoomId,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
    },
    { room_id: newRoomId }
  );

  res.json({
    success: true,
    message: "Room changed successfully",
    booking,
  });
});

/**
 * EXTEND STAY
 */
export const extendStay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newCheckOut } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found",
    });
  }

  if (String(booking.hotel_id) !== String(req.user.hotel_id)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  const newCheckOutDT = new Date(newCheckOut);
  if (isNaN(newCheckOutDT.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid checkout date/time",
    });
  }

  if (newCheckOutDT <= booking.checkOut) {
    return res.status(400).json({
      success: false,
      message: "New checkout must be after current checkout",
    });
  }

  /* --------------------------------------------------
   * CORRECT OVERLAP CHECK
   * -------------------------------------------------- */
  const conflict = await RoomBooking.findOne({
    _id: { $ne: booking._id },
    hotel_id: booking.hotel_id,
    room_id: booking.room_id,
    status: { $nin: ["CANCELLED"] },

    // ✅ TRUE overlap condition
    checkIn: { $lt: newCheckOutDT },
    checkOut: { $gt: booking.checkOut },
  }).sort({ checkIn: 1 });

  if (conflict) {
    const conflictCheckIn = new Date(conflict.checkIn);
    const sameDay =
      conflictCheckIn.toDateString() === newCheckOutDT.toDateString();

    // ❌ HARD BLOCK
    if (conflictCheckIn < newCheckOutDT) {
      return res.status(409).json({
        success: false,
        code: "ROOM_ALREADY_BOOKED",
        message: `Room has another booking starting on ${conflictCheckIn.toLocaleString()}`,
        conflict: {
          bookingId: conflict._id,
          checkIn: conflict.checkIn,
        },
      });
    }

    // ⚠️ SOFT WARNING (same day, later time)
    if (sameDay && conflictCheckIn > newCheckOutDT) {
      booking.checkOut = newCheckOutDT;
      await booking.save();

      return res.json({
        success: true,
        warning: true,
        message: `Room has a check-in on the same day at ${conflictCheckIn.toLocaleTimeString()}`,
        booking,
      });
    }
  }

  /* --------------------------------------------------
   * SAFE TO EXTEND
   * -------------------------------------------------- */
  booking.checkOut = newCheckOutDT;
  await booking.save();

  return res.json({
    success: true,
    message: "Stay extended successfully",
    booking,
  });
});

export const updateBookingServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { addedServices } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (String(booking.hotel_id) !== String(req.user.hotel_id))
    return res.status(403).json({ success: false, message: "Forbidden" });

  if (!Array.isArray(addedServices)) {
    return res.status(400).json({
      success: false,
      message: "Invalid services payload",
    });
  }

  // sanitize services
  booking.addedServices = addedServices.map(s => ({
    name: s.name,
    price: Number(s.price) || 0,
    days: Array.isArray(s.days) ? s.days.map(Number) : [],
    gstEnabled: s.gstEnabled !== false, // default true
  }));

  await booking.save();

  res.json({
    success: true,
    message: "Extra services updated successfully",
    booking,
  });
});

export const getRoomServiceBillForBooking = asyncHandler(async (req, res) => {
  const bookingId = req.params.bookingId;

  const booking = await RoomBooking.findById(bookingId);
  if (!booking) {
    return res.json({ success: true, orders: [], summary: null });
  }

  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  /* -----------------------------------------
   * 1️⃣ OLD LOGIC — QR orders + Room service orders
   *     Must stay because they are inside stay window
   * ----------------------------------------- */
  const qrAndRoomOrders = await Order.find({
    room_id: booking.room_id,
    hotel_id: booking.hotel_id,
    createdAt: { $gte: checkIn, $lt: checkOut }
  });

  /* -----------------------------------------
   * 2️⃣ NEW LOGIC — Transferred restaurant bills
   *     (orders not placed through QR but transferred manually)
   *     They have: 
   *     - paymentStatus: "PENDING"
   *     - status: "DELIVERED"
   * ----------------------------------------- */
  const transferredOrders = await Order.find({
    room_id: booking.room_id,
    hotel_id: booking.hotel_id,
    paymentStatus: "PENDING",
    status: "DELIVERED",
    createdAt: { $not: { $gte: checkIn, $lt: checkOut } } // avoid duplicating same orders
  });

  /* -----------------------------------------
   * 3️⃣ MERGE BOTH WITHOUT DUPLICATES
   * ----------------------------------------- */
  const allOrders = [...qrAndRoomOrders, ...transferredOrders];

  /* -----------------------------------------
   * 4️⃣ CALCULATE SUMMARY
   * ----------------------------------------- */
  const subtotal = allOrders.reduce((s, o) => s + o.subtotal, 0);
  const gstRaw = allOrders.reduce((s, o) => s + o.gst, 0);
  const grossTotal = subtotal + gstRaw;

  const discountPercent = booking.foodDiscount || 0;
  const discountAmount = +((grossTotal * discountPercent) / 100).toFixed(2);

  const finalGST = booking.foodGSTEnabled ? gstRaw : 0;

  const finalTotal = +(grossTotal - discountAmount - (booking.foodGSTEnabled ? 0 : gstRaw)).toFixed(2);

  return res.json({
    success: true,
    orders: allOrders,
    summary: {
      subtotal,
      discountPercent,
      discountAmount,
      gst: finalGST,
      total: finalTotal,
      gstEnabled: booking.foodGSTEnabled
    }
  });
});


export const updateFoodBilling = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { foodDiscount, foodGSTEnabled } = req.body;

  const booking = await RoomBooking.findById(id);
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  // Get food orders inside stay duration
  const orders = await Order.find({
    hotel_id: booking.hotel_id,
    room_id: booking.room_id,
    createdAt: { $gte: booking.checkIn, $lt: booking.checkOut },
    paymentStatus: "PENDING"
  });

  const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  const gst = orders.reduce((s, o) => s + o.gst, 0);
  const grossTotal = subtotal + gst;

  // Apply discount only on gross total
  const discountPercent = Number(foodDiscount || 0);
  const discountAmount = +((grossTotal * discountPercent) / 100).toFixed(2);

  // Remove GST entirely if disabled
  const finalGST = foodGSTEnabled ? gst : 0;

  const finalTotal = +(grossTotal - discountAmount - (foodGSTEnabled ? 0 : gst)).toFixed(2);

  booking.foodDiscount = discountPercent;
  booking.foodDiscountAmount = discountAmount;
  booking.foodGSTEnabled = foodGSTEnabled;

  booking.foodTotals = {
    subtotal,
    gst: finalGST,
    total: finalTotal
  };

  await booking.save();

  res.json({
    success: true,
    booking,
    summary: booking.foodTotals
  });
});

export const updateRoomBilling = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { discount, gstEnabled } = req.body;

  const booking = await RoomBooking.findById(id).populate("room_id");
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  // Recompute stay total
  const nights = Math.max(
    1,
    Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24))
  );

  const planCode = booking.planCode;
  const isSingle = planCode.includes("SINGLE");
  const plan = booking.room_id.plans.find(p => p.code === planCode.split("_")[0]);
  const rate = isSingle ? plan.singlePrice : plan.doublePrice;

  const stayAmount = rate * nights;
  const extraAmount = (booking.addedServices || []).reduce((s, e) => s + Number(e.price || 0), 0);

  const base = stayAmount + extraAmount;

  // GST
  let cgst = gstEnabled ? +(base * 0.025).toFixed(2) : 0;
  let sgst = gstEnabled ? +(base * 0.025).toFixed(2) : 0;

  const gross = base + cgst + sgst;

  const discountPercent = Number(discount || 0);
  const discountAmount = +((gross * discountPercent) / 100).toFixed(2);

  const roomTotal = +(gross - discountAmount).toFixed(2);

  booking.gstEnabled = gstEnabled;
  booking.discount = discountPercent;
  booking.discountAmount = discountAmount;

  booking.taxable = base;
  booking.cgst = cgst;
  booking.sgst = sgst;

  // Balance update
  const foodTotal = booking.foodTotals?.total || 0;
  booking.balanceDue = +(roomTotal + foodTotal - booking.advancePaid).toFixed(2);

  await booking.save();

  res.json({
    success: true,
    booking
  });
});

export const getActiveRoomsToday = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const now = new Date();

  const bookings = await RoomBooking.find({
    hotel_id,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] },

    // Guest has already checked in
    checkIn: { $lte: now },

    // Guest has not checked out yet
    checkOut: { $gt: now }
  }).populate("room_id");

  const rooms = bookings
    .filter(b => b.room_id)   // ensure room exists
    .map(b => ({
      _id: b.room_id._id,
      number: b.room_id.number,
      type: b.room_id.type,
      liveStatus: "OCCUPIED",
      booking: b
    }));

  res.json({
    success: true,
    rooms
  });
});

