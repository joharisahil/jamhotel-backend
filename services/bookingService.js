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
  discount = 0,
  guestIds = [],
  addedServices = [],
  ...rest
}) => {
  // availability check (simple)
  const overlapping = await RoomBooking.findOne({
    room_id, hotel_id,
    status: { $in: ["OCCUPIED","CHECKEDIN"] },
    $or: [
      { checkIn: { $lte: new Date(checkOut) }, checkOut: { $gte: new Date(checkIn) } }
    ]
  });
  if (overlapping) throw new Error("Room not available in selected dates");
// 1️⃣ Find room
  const room = await Room.findById(room_id);
  if (!room) throw new Error("Room not found");

  // 2️⃣ Find selected plan
  const plan = room.plans.find(p =>
    p.code === planCode ||
    `${p.code}_SINGLE` === planCode ||
    `${p.code}_DOUBLE` === planCode
  );

  if (!plan) throw new Error("Invalid plan selected");

  const isSingle = planCode.includes("SINGLE");
  const planPrice = isSingle ? plan.singlePrice : plan.doublePrice;

  // 3️⃣ Calculate nights
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

  // 4️⃣ Room Price
  const roomTotal = planPrice * nights;

  // 5️⃣ Extra services
  const extrasTotal = addedServices.reduce((sum, e) => sum + (e.price || 0), 0);

  // 6️⃣ Grand total before discount
  const grossTotal = roomTotal + extrasTotal;

  // 7️⃣ Final total after discount
  const finalTotal = grossTotal - discount;

  // 8️⃣ Balance Due
  const balanceDue = Math.max(0, finalTotal - advancePaid);

  // 9️⃣ Save Booking
  const booking = await RoomBooking.create({
    hotel_id,
    room_id,
    checkIn,
    checkOut,
    planCode,
    adults,
    children,
    advancePaid,
    discount,
    addedServices,
    balanceDue,
    ...rest
  });

  // Set room status
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

    // 1️⃣ Calculate stay charges
    const plan = room.plans.find(p =>
      `${p.code}_SINGLE` === booking.planCode ||
      `${p.code}_DOUBLE` === booking.planCode
    );
    const rate = booking.planCode.includes("SINGLE") ? plan.singlePrice : plan.doublePrice;

    const nights = Math.max(
      1,
      Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000*60*60*24))
    );

    const stayAmount = rate * nights;
    const extraTotal = booking.addedServices.reduce((sum, e) => sum + e.price, 0);
    const stayTotal = stayAmount + extraTotal;

    // 2️⃣ Fetch food orders for this room
    const foodOrders = await Order.find({
      room_id: booking.room_id,
      hotel_id: booking.hotel_id,
      paymentStatus: "PENDING",
      status: "DELIVERED"
    }).session(session);

    const foodSubtotal = foodOrders.reduce((s,o)=> s + o.subtotal, 0);
    const foodGST = foodOrders.reduce((s,o)=> s + o.gst, 0);
    const foodTotal = foodSubtotal + foodGST;

    // 3️⃣ Final bill
    const totalBeforeDiscount = stayTotal + foodTotal;
    const finalAmount = totalBeforeDiscount - (booking.discount || 0);
    const balanceDue = finalAmount - booking.advancePaid;

    const invoiceNumber = "ROOM-" + Date.now();

    // 4️⃣ Save invoice
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

      discount: booking.discount,
      totalAmount: finalAmount,
      advancePaid: booking.advancePaid,
      balanceDue
    }], { session });

    // 5️⃣ Mark food orders as paid
    await Order.updateMany(
      { _id: { $in: foodOrders.map(o=>o._id) }},
      { paymentStatus: "PAID" },
      { session }
    );

    // 6️⃣ Checkout booking
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
      description: `Full room + food invoice for Room ${room.number}`,
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
