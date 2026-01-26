export const buildPricingContext = (booking) => {
  return {
    bookingId: booking._id,

    pricingMode: booking.pricingMode || "PLAN",
    finalRoomPrice: booking.finalRoomPrice || null,

    gstEnabled: booking.gstEnabled,
    discount: Number(booking.discount || 0),
    roundOffEnabled: booking.roundOffEnabled,

    nights: 1, // computed here

    room: {},
    extras: {},
    food: {},
    advances: {},
    totals: {},
  };
};
