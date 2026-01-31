export const recalculatePayments = (booking) => {
  if (!booking) return booking;

  /* ===================== NIGHTS ===================== */
  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);

  const nights = Math.max(
    1,
    Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
  );

  booking.nights = nights;

  /* ===================== ROOM PRICE ===================== */
  let roomPrice = 0;

  if (booking.room_id?.plans?.length && booking.planCode) {
    const [planCode, occupancy] = booking.planCode.split("_");
    const plan = booking.room_id.plans.find(p => p.code === planCode);

    if (plan) {
      roomPrice =
        occupancy === "SINGLE"
          ? plan.singlePrice
          : plan.doublePrice;
    }
  }

  if (!roomPrice) {
    roomPrice = booking.room_id?.baseRate || 0;
  }

  booking.roomPrice = roomPrice;
  booking.roomStayTotal = +(roomPrice * nights).toFixed(2);

  /* ===================== EXTRAS ===================== */
  let extrasBase = 0;

  (booking.addedServices || []).forEach(service => {
    const days =
      Array.isArray(service.days) && service.days.length > 0
        ? service.days.length
        : nights;

    extrasBase += (service.price || 0) * days;
  });

  booking.extrasBase = +extrasBase.toFixed(2);

  const extrasGST = booking.gstEnabled
    ? +(extrasBase * 0.05).toFixed(2)
    : 0;

  booking.extrasGST = extrasGST;
  booking.extrasTotal = +(extrasBase + extrasGST).toFixed(2);

  /* ===================== DISCOUNT ===================== */
  const discountPercent = Number(booking.discount || 0);
  booking.discountAmount = +(
    ((booking.roomStayTotal + extrasBase) * discountPercent) / 100
  ).toFixed(2);

  /* ===================== TAXABLE ===================== */
  const taxableAmount = booking.gstEnabled
    ? booking.roomStayTotal + extrasBase - booking.discountAmount
    : 0;

  const gstTotal = booking.gstEnabled
    ? +(taxableAmount * 0.05).toFixed(2)
    : 0;

  booking.taxable = +taxableAmount.toFixed(2);
  booking.cgst = +(gstTotal / 2).toFixed(2);
  booking.sgst = +(gstTotal / 2).toFixed(2);

 
  /* ===================== GRAND TOTAL ===================== */
  let grandTotal =
    booking.taxable +
    booking.cgst +
    booking.sgst +
    booking.foodTotals.total;

  /* ===================== ROUND OFF ===================== */
  let roundOffAmount = 0;

  if (booking.roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    roundOffAmount = +(rounded - grandTotal).toFixed(2);
    grandTotal = rounded;
  }

  booking.roundOffAmount = roundOffAmount;
  booking.grandTotal = +grandTotal.toFixed(2);

  /* ===================== ADVANCES ===================== */
  booking.advancePaid = (booking.advances || []).reduce(
    (sum, a) => sum + (a.amount || 0),
    0
  );

  /* ===================== BALANCE ===================== */
  booking.balanceDue = +(
    booking.grandTotal - booking.advancePaid
  ).toFixed(2);

  /* ===================== FINAL PAYMENT ===================== */
  booking.finalPaymentReceived = booking.balanceDue <= 0;

  booking.finalPaymentAmount = booking.finalPaymentReceived
    ? booking.grandTotal
    : 0;

  return booking;
};

// export const recalculatePayments = (booking) => {
//   if (!booking) return booking;

//   /* ===================== NIGHTS ===================== */
//   const checkIn = new Date(booking.checkIn);
//   const checkOut = new Date(booking.checkOut);

//   const nights = Math.max(
//     1,
//     Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
//   );

//   /* ===================== ROOM PRICE ===================== */
//   let roomPrice = 0;

//   if (booking.room_id?.plans?.length && booking.planCode) {
//     const [planCode, occupancy] = booking.planCode.split("_");
//     const plan = booking.room_id.plans.find(p => p.code === planCode);

//     if (plan) {
//       roomPrice =
//         occupancy === "SINGLE"
//           ? plan.singlePrice
//           : plan.doublePrice;
//     }
//   }

//   // fallback
//   if (!roomPrice) {
//     roomPrice = booking.room_id?.baseRate || 0;
//   }

//   const roomStayTotal = roomPrice * nights;

//   /* ===================== EXTRAS ===================== */
//   let extrasBase = 0;

//   (booking.addedServices || []).forEach(service => {
//     const days =
//       Array.isArray(service.days) && service.days.length > 0
//         ? service.days.length
//         : nights;

//     extrasBase += (service.price || 0) * days;
//   });

//   /* ===================== DISCOUNT ===================== */
//   const discountPercent = Number(booking.discount || 0);
//   const discountAmount = +(
//     ((roomStayTotal + extrasBase) * discountPercent) / 100
//   ).toFixed(2);

//   booking.discountAmount = discountAmount;

//   /* ===================== TAXABLE ===================== */
//   const taxableAmount = booking.gstEnabled
//     ? roomStayTotal + extrasBase - discountAmount
//     : 0;

//   const gstTotal = booking.gstEnabled
//     ? +(taxableAmount * 0.05).toFixed(2)
//     : 0;

//   const cgst = +(gstTotal / 2).toFixed(2);
//   const sgst = +(gstTotal / 2).toFixed(2);

//   booking.taxable = taxableAmount;
//   booking.cgst = cgst;
//   booking.sgst = sgst;

//   /* ===================== FOOD ===================== */
//   const foodSubtotal = booking.foodTotals?.subtotal || 0;

//   const foodDiscountPercent = Number(booking.foodDiscount || 0);
//   const foodDiscountAmount = +(
//     (foodSubtotal * foodDiscountPercent) / 100
//   ).toFixed(2);

//   booking.foodDiscountAmount = foodDiscountAmount;

//   const foodAfterDiscount = foodSubtotal - foodDiscountAmount;

//   const foodGST = booking.foodGSTEnabled
//     ? +(foodAfterDiscount * 0.05).toFixed(2)
//     : 0;

//   booking.foodTotals = {
//     subtotal: foodSubtotal,
//     gst: foodGST,
//     total: foodAfterDiscount + foodGST,
//   };

//   /* ===================== GRAND TOTAL ===================== */
//   let grandTotal =
//     taxableAmount +
//     cgst +
//     sgst +
//     booking.foodTotals.total;

//   /* ===================== ROUND OFF ===================== */
//   let roundOffAmount = 0;

//   if (booking.roundOffEnabled) {
//     const rounded = Math.round(grandTotal);
//     roundOffAmount = +(rounded - grandTotal).toFixed(2);
//     grandTotal = rounded;
//   }

//   booking.roundOffAmount = roundOffAmount;

//   /* ===================== ADVANCES ===================== */
//   const advancePaid = (booking.advances || []).reduce(
//     (sum, a) => sum + (a.amount || 0),
//     0
//   );

//   booking.advancePaid = advancePaid;

//   /* ===================== BALANCE ===================== */
//   booking.balanceDue = +(grandTotal - advancePaid).toFixed(2);

//   /* ===================== FINAL PAYMENT FLAG ===================== */
//   booking.finalPaymentReceived = booking.balanceDue <= 0;

//   if (booking.finalPaymentReceived) {
//     booking.finalPaymentAmount = grandTotal;
//   }

//   return booking;
// };
