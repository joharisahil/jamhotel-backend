import { calculateRoom } from "./room.engine.js";
import { calculateExtras } from "./extras.engine.js";
import { calculateFood } from "./food.engine.js";
import { calculateAdvances } from "./advance.engine.js";
import { validatePricingContext } from "./validators.js";

export const runPriceEngine = async (booking) => {
  const ctx = {
    flags: {
      isSpecialPricing:
        booking.pricingMode === "SPECIAL" &&
        typeof booking.finalRoomPrice === "number" &&
        booking.finalRoomPrice > 0,
    },

    nights: 1,
    room: {},
    extras: {},
    food: {},
    advances: {},
    totals: {},
  };

  // 1️⃣ ROOM
  calculateRoom(ctx, booking);

  // 2️⃣ EXTRAS
  calculateExtras(ctx, booking);

  // 3️⃣ FOOD
  await calculateFood(ctx, booking);

  // 4️⃣ ADVANCES
  calculateAdvances(ctx, booking);

  // 5️⃣ VALIDATION (CRITICAL)
  validatePricingContext(ctx);

  return ctx;
};


/**
 * =========================================================
 * PRICE ENGINE – SINGLE SOURCE OF BILLING TRUTH
 * =========================================================
 *
 * This engine is responsible for calculating ALL monetary
 * values of a room booking in a deterministic, safe way.
 *
 * ❗ Controllers must NEVER perform pricing math.
 * ❗ Models must NEVER guess totals.
 * ❗ Fetching a booking MUST produce the same totals
 *    as booking creation.
 *
 * ---------------------------------------------------------
 * WORKFLOW (ORDER MATTERS)
 * ---------------------------------------------------------
 *
 * 1️⃣ ROOM ENGINE
 *    - Decides pricing mode:
 *        • PLAN pricing (old behavior)
 *        • SPECIAL pricing (final GST-inclusive price)
 *    - Calculates:
 *        • room.base   (GST exclusive)
 *        • room.gst
 *        • room.total (base + gst)
 *
 * 2️⃣ EXTRAS ENGINE
 *    - Calculates all extra services independently
 *    - Applies GST only if enabled
 *    - Outputs:
 *        • extras.base
 *        • extras.gst
 *        • extras.total
 *
 * 3️⃣ FOOD ENGINE
 *    - Delegated to existing food billing service
 *    - Engine only consumes the final food total
 *
 * 4️⃣ ADVANCE ENGINE
 *    - Aggregates advance payments
 *    - Ensures advancePaid is always accurate
 *
 * 5️⃣ TOTAL ENGINE
 *    - Applies discounts (scope aware)
 *    - Calculates taxable amount
 *    - Splits GST into CGST / SGST
 *    - Applies round-off
 *    - Produces:
 *        • grandTotal
 *        • balanceDue
 *
 * ---------------------------------------------------------
 * GUARANTEES
 * ---------------------------------------------------------
 *
 * • GST is NEVER double counted
 * • SPECIAL pricing NEVER falls back to plan pricing
 * • Extras NEVER overwrite room pricing
 * • Discounts NEVER create negative totals
 * • Fetching, updating, and checkout all use
 *   the exact same pricing logic
 *
 * ---------------------------------------------------------
 * DESIGN PRINCIPLES
 * ---------------------------------------------------------
 *
 * • Pure calculation (no DB writes)
 * • Fully deterministic
 * • Modular and testable
 * • Backward compatible with existing responses
 *
 * ---------------------------------------------------------
 * If totals look wrong, the bug is HERE — not in controllers.
 * =========================================================
 */
