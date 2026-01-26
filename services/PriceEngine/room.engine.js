export const calculateRoom = (ctx, booking) => {
  const nights = ctx.nights;
  const gstRate = 0.05;

  let base = 0;
  let gst = 0;

  if (ctx.flags.isSpecialPricing) {
    // finalRoomPrice = GST-INCLUSIVE PER NIGHT
    const finalPerNight = booking.finalRoomPrice;

    const basePerNight = +(finalPerNight / (1 + gstRate)).toFixed(2);
    const gstPerNight = +(finalPerNight - basePerNight).toFixed(2);

    base = +(basePerNight * nights).toFixed(2);
    gst = +(gstPerNight * nights).toFixed(2);
  } else {
    // PLAN BASED
    let roomRate = 0;

    if (booking.room_id?.plans?.length && booking.planCode) {
      const [planCode, occupancy] = booking.planCode.split("_");
      const plan = booking.room_id.plans.find((p) => p.code === planCode);

      if (plan) {
        roomRate =
          occupancy === "SINGLE"
            ? plan.singlePrice
            : plan.doublePrice;
      }
    }

    if (!roomRate) {
      roomRate = booking.room_id?.baseRate || 0;
    }

    base = +(roomRate * nights).toFixed(2);
    gst = booking.gstEnabled ? +(base * gstRate).toFixed(2) : 0;
  }

  ctx.room = {
    base,
    gst,
    total: +(base + gst).toFixed(2),
  };
};
