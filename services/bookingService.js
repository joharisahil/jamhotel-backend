import RoomBooking from "../models/RoomBooking.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";

export const createBooking = async ({ hotel_id, room_id, checkIn, checkOut, ...rest }) => {
  // availability check (simple)
  const overlapping = await RoomBooking.findOne({
    room_id, hotel_id,
    status: { $in: ["BOOKED","CHECKEDIN"] },
    $or: [
      { checkIn: { $lte: new Date(checkOut) }, checkOut: { $gte: new Date(checkIn) } }
    ]
  });
  if (overlapping) throw new Error("Room not available in selected dates");
  const booking = await RoomBooking.create({ hotel_id, room_id, checkIn, checkOut, ...rest });
  await Room.findByIdAndUpdate(room_id, { status: "BOOKED" });
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
