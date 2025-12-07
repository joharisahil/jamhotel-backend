import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";

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

export const checkoutBooking = async (bookingId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await RoomBooking.findById(bookingId).session(session);
    if (!booking) throw new Error("Booking not found");
    booking.status = "CHECKEDOUT";
    await booking.save({ session });
    await Room.findByIdAndUpdate(booking.room_id, { status: "AVAILABLE" }).session(session);
    await session.commitTransaction();
    session.endSession();
    return booking;
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    throw err;
  }
};
