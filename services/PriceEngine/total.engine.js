export const calculateTotal = (ctx, booking) => {
  const discountPercent = Number(booking.discount || 0);

  const grossBase =
    ctx.room.base +
    ctx.extras.base;

  const discountAmount =
    discountPercent > 0
      ? +((grossBase * discountPercent) / 100).toFixed(2)
      : 0;

  const taxable = Math.max(
    +(grossBase - discountAmount).toFixed(2),
    0
  );

  const gst =
    booking.gstEnabled
      ? +(taxable * 0.05).toFixed(2)
      : 0;

  let grandTotal =
    taxable +
    gst +
    (ctx.food?.total || 0);

  let roundOffAmount = 0;

  if (booking.roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    roundOffAmount = +(rounded - grandTotal).toFixed(2);
    grandTotal = rounded;
  }

  ctx.totals = {
    discountAmount,
    taxable,
    cgst: +(gst / 2).toFixed(2),
    sgst: +(gst / 2).toFixed(2),
    grandTotal: +grandTotal.toFixed(2),
    roundOffAmount,
    balanceDue: Math.max(
      +(grandTotal - (ctx.advances?.paid || 0)).toFixed(2),
      0
    ),
  };
};
