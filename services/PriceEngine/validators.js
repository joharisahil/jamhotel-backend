// services/PriceEngine/validators.js

export function validatePricingContext(booking) {
  if (!booking || typeof booking !== "object") {
    throw new Error("PricingEngine: booking object missing");
  }

  if (!booking.checkIn || !booking.checkOut) {
    throw new Error("PricingEngine: checkIn/checkOut missing");
  }

  // ✅ ALWAYS normalize first
  const checkInDT = new Date(booking.checkIn);
  const checkOutDT = new Date(booking.checkOut);

  if (
    !(checkInDT instanceof Date) ||
    isNaN(checkInDT.getTime()) ||
    !(checkOutDT instanceof Date) ||
    isNaN(checkOutDT.getTime())
  ) {
    throw new Error("Invalid check-in/check-out datetime");
  }

  if (checkInDT >= checkOutDT) {
    throw new Error("checkIn must be before checkOut");
  }

  // ✅ Normalize back (VERY IMPORTANT)
  booking.checkIn = checkInDT;
  booking.checkOut = checkOutDT;
}
