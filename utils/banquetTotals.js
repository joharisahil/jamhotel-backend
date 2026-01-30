export const calculateTotals = (booking) => {
  let foodAmount = 0;
  let hallAmount = 0;
  let servicesAmount = 0;

  // FOOD
  if (booking.pricingMode === "PLAN") {
    foodAmount = booking.guestsCount * booking.plan.ratePerPerson;
  } else if (booking.pricingMode === "CUSTOM_FOOD") {
    foodAmount = booking.customFoodAmount || 0;
  }

  // HALL
  hallAmount = booking.hall?.isComplimentary
    ? 0
    : booking.hall?.baseCharge || 0;

  // SERVICES
  servicesAmount = (booking.services || [])
    .filter(s => s.chargeable)
    .reduce((sum, s) => sum + s.amount, 0);

  const subTotal = foodAmount + hallAmount + servicesAmount;

  // DISCOUNT
  let discountAmount = 0;
  if (booking.discount?.value) {
    if (booking.discount.type === "PERCENT") {
      discountAmount = (booking.discount.value / 100) * subTotal;
    } else {
      discountAmount = booking.discount.value;
    }
    discountAmount = Math.min(discountAmount, subTotal);
  }

  // TAX
  const taxable = subTotal - discountAmount;
  const gstAmount = booking.gstEnabled
  ? (taxable * booking.gstPercent) / 100
  : 0;

  // PAYMENTS
  const paidAmount = (booking.payments || [])
    .reduce((sum, p) => sum + p.amount, 0);

  const grandTotal = taxable + gstAmount;
  const balanceAmount = grandTotal - paidAmount;

  return {
    foodAmount,
    hallAmount,
    servicesAmount,
    discountAmount,
    gstAmount,
    grandTotal,
    paidAmount,
    balanceAmount,
  };
};
