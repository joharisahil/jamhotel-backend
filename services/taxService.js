/**
 * @service taxService.js
 * @description Calculates GST tax components for invoice line items.
 *              Supports CGST+SGST (intra-state) and IGST (inter-state).
 *              All calculations are performed on the backend — client values are ignored.
 */import { TAX_TYPE } from "../constants/enums.js";

/**
 * Determines whether to apply CGST+SGST or IGST
 */
export function getTaxMode(isInterState = false) {
  return isInterState ? "IGST" : "CGST_SGST";
}

/**
 * Calculates tax breakdown for a single line item.
 */
export function calculateLineItemTax({
  quantity,
  unitPrice,
  gstPercentage = 0,
  isInterState = false,
}) {
  const subtotal = round(quantity * unitPrice);
  const taxRate = gstPercentage / 100;
  const totalTax = round(subtotal * taxRate);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let taxType = TAX_TYPE.NONE;

  if (gstPercentage > 0) {
    const mode = getTaxMode(isInterState);

    if (mode === "IGST") {
      igstAmount = totalTax;
      taxType = TAX_TYPE.IGST;
    } else {
      cgstAmount = round(totalTax / 2);
      sgstAmount = round(totalTax - cgstAmount);
      taxType = TAX_TYPE.CGST;
    }
  }

  return {
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount: totalTax,
    totalAmount: round(subtotal + totalTax),
    taxType,
  };
}

/**
 * Calculates totals for an entire invoice.
 */
export function calculateInvoiceTotals(
  lineItems,
  isInterState = false
) {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const enrichedItems = lineItems.map((item) => {
    const calc = calculateLineItemTax({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstPercentage: item.gstPercentage || 0,
      isInterState,
    });

    subtotal += calc.subtotal;
    totalCgst += calc.cgstAmount;
    totalSgst += calc.sgstAmount;
    totalIgst += calc.igstAmount;

    return {
      ...item,
      subtotal: calc.subtotal,
      cgstAmount: calc.cgstAmount,
      sgstAmount: calc.sgstAmount,
      igstAmount: calc.igstAmount,
      gstAmount: calc.gstAmount,
      totalAmount: calc.totalAmount,
      taxType: calc.taxType,
    };
  });

  const totalTax = round(totalCgst + totalSgst + totalIgst);
  const grandTotal = round(subtotal + totalTax);

  return {
    items: enrichedItems,
    subtotal: round(subtotal),
    gstAmount: totalTax,
    taxBreakdown: {
      cgst: round(totalCgst),
      sgst: round(totalSgst),
      igst: round(totalIgst),
      totalTax,
    },
    grandTotal,
  };
}

/**
 * Rounds to 2 decimal places.
 */
export function round(value) {
  return (
    Math.round((value + Number.EPSILON) * 100) / 100
  );
}
