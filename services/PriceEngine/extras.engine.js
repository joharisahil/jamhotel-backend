export const calculateExtras = (ctx, booking) => {
  const gstRate = 0.05;
  let base = 0;

  (booking.addedServices || []).forEach((service) => {
    const days =
      Array.isArray(service.days) && service.days.length > 0
        ? service.days.length
        : ctx.nights;

    base += (service.price || 0) * days;
  });

  base = +base.toFixed(2);

  const gst =
    booking.gstEnabled && base > 0
      ? +(base * gstRate).toFixed(2)
      : 0;

  ctx.extras = {
    base,
    gst,
    total: +(base + gst).toFixed(2),
  };
};
