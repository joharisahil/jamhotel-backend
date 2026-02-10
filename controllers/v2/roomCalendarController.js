import RoomBooking from "../../models/RoomBooking.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// /**
//  * GET BOOKINGS FOR CALENDAR VIEW
//  * /room-bookings/calendar?from=&to=
//  */
// export const getRoomBookingsForCalendar = asyncHandler(async (req, res) => {
//   const hotel_id = req.user.hotel_id;
//   const { from, to } = req.query;

//   if (!from || !to) {
//     return res.status(400).json({
//       success: false,
//       message: "from and to dates are required",
//     });
//   }

//   const startDate = new Date(from);
//   const endDate = new Date(to);

//   const bookings = await RoomBooking.find({
//     hotel_id,
//     checkIn: { $lt: endDate },
//     checkOut: { $gt: startDate },
//     status: { $in: ["OCCUPIED", "CONFIRMED", "BLOCKED", "MAINTENANCE"] },
//   })
//     .select(
//       "_id room_id checkIn checkOut status guestName companyName source"
//     )
//     .populate("room_id", "number type floor")
//     .sort({ checkIn: 1 });

//   res.json({
//     success: true,
//     bookings,
//   });
// });
export const getRoomBookingsForCalendar = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message: "from and to dates are required",
    });
  }

  const startDate = new Date(from);
  const endDate = new Date(to);

  const bookings = await RoomBooking.find({
    hotel_id,
    checkIn: { $lt: endDate },
    checkOut: { $gt: startDate },
    status: { $in: ["OCCUPIED", "CONFIRMED", "BLOCKED", "MAINTENANCE"] },
  })
    .select(
      `
      _id
      room_id
      checkIn
      checkOut
      status
      guestName
      guestPhone
      companyName
      source
      adults
      grandTotal
      advancePaid
      `
    )
    .populate("room_id", "number type floor")
    .sort({ checkIn: 1 });

  const enrichedBookings = bookings.map((b) => {
    const total = b.grandTotal || 0;
    const paid = b.advancePaid || 0;

    let paymentStatus = "DUE";
    if (paid >= total && total > 0) paymentStatus = "PAID";
    else if (paid > 0) paymentStatus = "PARTIAL";

    return {
      ...b.toObject(),
      guests: {
        name: b.guestName,
        phone: b.guestPhone || "",
        adults: b.adults || 1,
      },
      payment: {
        total,
        paid,
        status: paymentStatus,
      },
    };
  });

  res.json({
    success: true,
    bookings: enrichedBookings,
  });
});
