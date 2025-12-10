import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";
import RoomInvoice from "../models/RoomInvoice.js";
import Order from "../models/Order.js";
import * as transactionService from "../services/transactionService.js";

export const createBooking = async ({
  hotel_id,
  room_id,
  checkIn,
  checkOut,
  planCode,
  adults,
  children,
  advancePaid = 0,
  discount = 0,    // percentage %
  guestIds = [],
  addedServices = [],
  ...rest
}) => {

  // Check availability
  const overlapping = await RoomBooking.findOne({
    room_id,
    hotel_id,
    status: { $in: ["OCCUPIED", "CHECKEDIN"] },
    $or: [
      {
        checkIn: { $lte: new Date(checkOut) },
        checkOut: { $gte: new Date(checkIn) }
      }
    ]
  });

  if (overlapping) throw new Error("Room not available in selected dates");

  // Load room
  const room = await Room.findById(room_id);
  if (!room) throw new Error("Room not found");

  // Find plan
  const plan = room.plans.find(p =>
    p.code === planCode ||
    `${p.code}_SINGLE` === planCode ||
    `${p.code}_DOUBLE` === planCode
  );
  if (!plan) throw new Error("Invalid plan selected");

  const isSingle = planCode.includes("SINGLE");
  const planPrice = isSingle ? plan.singlePrice : plan.doublePrice;

  // Nights
  const nights = Math.max(1, (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

  // Room total
  const roomTotal = planPrice * nights;

  // Extras
  const extrasTotal = addedServices.reduce((s, e) => s + (e.price || 0), 0);

  // Base price (before GST)
  const baseTotal = roomTotal + extrasTotal;

  // Discount (percentage)
  const discountPercent = Number(discount || 0);
  const discountAmount = +((baseTotal * discountPercent) / 100).toFixed(2);

  // Taxable
  const taxable = baseTotal - discountAmount;

  // GST
  const cgst = +(taxable * 0.025).toFixed(2);
  const sgst = +(taxable * 0.025).toFixed(2);

  // Final
  const finalTotal = taxable + cgst + sgst;

  // Balance due
  const balanceDue = Math.max(0, finalTotal - advancePaid);

  // Save booking
  const booking = await RoomBooking.create({
    hotel_id,
    room_id,
    checkIn,
    checkOut,
    planCode,
    adults,
    children,
    advancePaid,
    discount: discountPercent,
    discountAmount,
    guestIds,
    addedServices,
    balanceDue,
    ...rest
  });

  // Update room status
  await Room.findByIdAndUpdate(room_id, { status: "OCCUPIED" });

  return booking;
};
export const checkoutBooking = async (bookingId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await RoomBooking.findById(bookingId).session(session);
    if (!booking) throw new Error("Booking not found");

    const room = await Room.findById(booking.room_id).session(session);
    if (!room) throw new Error("Room not found");

    // 1️⃣ Stay charges
    const plan = room.plans.find(p =>
      `${p.code}_SINGLE` === booking.planCode ||
      `${p.code}_DOUBLE` === booking.planCode
    );
    if (!plan) throw new Error("Invalid plan");

    const rate = booking.planCode.includes("SINGLE") ? plan.singlePrice : plan.doublePrice;

    const nights = Math.max(
      1,
      Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) /
        (1000 * 60 * 60 * 24))
    );

    const stayAmount = rate * nights;
    const extraTotal = booking.addedServices.reduce((s, e) => s + e.price, 0);
    const stayTotal = stayAmount + extraTotal;

    // GST Split (5%)
    const stayCGST = +(stayTotal * 0.025).toFixed(2);
    const staySGST = +(stayTotal * 0.025).toFixed(2);
    const stayGST = stayCGST + staySGST;

    // 2️⃣ Food orders
    const foodOrders = await Order.find({
      room_id: booking.room_id,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
      status: "DELIVERED"
    }).session(session);

    const foodSubtotal = foodOrders.reduce((s, o) => s + o.subtotal, 0);
    const foodGST = foodOrders.reduce((s, o) => s + o.gst, 0);
    const foodTotal = foodSubtotal + foodGST;

// 3️⃣ Apply discount correctly (ONLY on room charges)
const discountPercent = Number(booking.discount || 0);

// Discount must apply ONLY on stay charges (stayTotal + stayGST)
const discountBase = stayTotal + stayGST;

const discountAmount = +(
  discountBase * (discountPercent / 100)
).toFixed(2);

// Final amount = (room after discount) + food total
const finalAmount = (discountBase - discountAmount) + foodTotal;

// Remaining balance
const balanceDue = finalAmount - (booking.advancePaid || 0);


    const invoiceNumber = "ROOM-" + Date.now();

    // 4️⃣ Create invoice
    const invoice = await RoomInvoice.create([{
      hotel_id: booking.hotel_id,
      bookingId: booking._id,
      room_id: room._id,
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
      balanceDue
    }], { session });

    // 5️⃣ Mark food paid
    await Order.updateMany(
      { _id: { $in: foodOrders.map(o => o._id) } },
      { paymentStatus: "PAID" },
      { session }
    );

    // 6️⃣ Close booking
    booking.status = "CHECKEDOUT";
    booking.balanceDue = balanceDue;
    await booking.save({ session });

    // 7️⃣ Release room
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" }).session(session);

    // 8️⃣ Create transaction entry
    await transactionService.createTransaction(booking.hotel_id, {
      type: "CREDIT",
      source: "ROOM",
      amount: finalAmount,
      referenceId: invoice[0]._id,
      description: `Room + Food invoice for Room ${room.number}`
    });

    await session.commitTransaction();
    session.endSession();

    return invoice[0];

  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
};
