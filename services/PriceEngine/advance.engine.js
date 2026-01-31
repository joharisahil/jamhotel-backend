export const calculateAdvances = (ctx, booking) => {
  const advances = Array.isArray(booking.advances)
    ? booking.advances
    : [];

  const advancePaid = advances.reduce(
    (sum, a) => sum + Number(a.amount || 0),
    0
  );

  ctx.advances = {
    paid: +advancePaid.toFixed(2),
  };
};
