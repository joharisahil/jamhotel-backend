/**
 * @validators invoiceValidator.js
 * @description express-validator rules for purchase invoice endpoints.
 */import { body, param } from "express-validator";
import {
  PAYMENT_METHOD,
  ADJUSTMENT_REASON,
} from "../constants/enums.js";
import { validationResult } from "express-validator";

/* ── Shared helper ───────────────────────────────────────────────── */
const mongoId = (field) =>
  param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid ID`);

/* ── Invoice Line Item Rules ─────────────────────────────────────── */
const lineItemRules = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one line item is required"),

  body("items.*.item_id")
    .isMongoId()
    .withMessage("Each item must have a valid item_id"),

  body("items.*.quantity")
    .isFloat({ gt: 0 })
    .withMessage("Quantity must be positive"),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage("Unit price cannot be negative"),

  body("items.*.gstPercentage")
    .isFloat({ min: 0, max: 100 })
    .withMessage("GST % must be 0–100"),

  body("items.*.batchNumber")
    .if(body("items.*.isPerishable").equals(true))
    .notEmpty()
    .withMessage(
      "Batch number required for perishable items"
    ),

  body("items.*.expiryDate")
    .if(body("items.*.isPerishable").equals(true))
    .isISO8601()
    .withMessage(
      "Valid expiry date required for perishable items"
    ),
];

/* ── Create Invoice ──────────────────────────────────────────────── */
export const createInvoice = [
  body("vendor_id")
    .isMongoId()
    .withMessage("vendor_id must be a valid ID"),

  ...lineItemRules,

  body("notes")
    .optional()
    .isString()
    .isLength({ max: 2000 }),
];

/* ── Update Draft ────────────────────────────────────────────────── */
export const updateInvoice = [
  mongoId("id"),

  body("items")
    .optional()
    .isArray({ min: 1 }),

  body("notes")
    .optional()
    .isString()
    .isLength({ max: 2000 }),
];

/* ── Approve / Cancel ────────────────────────────────────────────── */
export const stateTransition = [
  mongoId("id"),

  body("note")
    .optional()
    .isString()
    .isLength({ max: 500 }),

  body("reason")
    .optional()
    .isString()
    .isLength({ max: 500 }),
];

/* ── Record Payment ──────────────────────────────────────────────── */
export const recordPayment = [
  mongoId("invoiceId"),

  body("amount")
    .isFloat({ gt: 0 })
    .withMessage(
      "Payment amount must be positive"
    ),

  body("method")
    .isIn(Object.values(PAYMENT_METHOD))
    .withMessage("Invalid payment method"),

  body("reference")
    .optional()
    .isString()
    .isLength({ max: 100 }),

  body("paidAt")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),

  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 }),
];

/* ── Stock Adjustment ────────────────────────────────────────────── */
export const createAdjustment = [
  body("item_id")
    .isMongoId()
    .withMessage(
      "item_id must be a valid ID"
    ),

  body("type")
    .isIn(["IN", "OUT"])
    .withMessage("Type must be IN or OUT"),

  body("quantity")
    .isFloat({ gt: 0 })
    .withMessage("Quantity must be positive"),

  body("reason")
    .isIn(
      Object.values(ADJUSTMENT_REASON)
    )
    .withMessage("Invalid reason code"),

  body("notes")
    .notEmpty()
    .withMessage(
      "Notes are required for audit trail"
    )
    .isLength({ max: 2000 }),
];

/* ── Credit Note ─────────────────────────────────────────────────── */
export const createCreditNote = [
  body("originalInvoiceId")
    .isMongoId()
    .withMessage(
      "originalInvoiceId must be a valid ID"
    ),

  body("reason")
    .notEmpty()
    .withMessage("Reason is required")
    .isLength({ max: 1000 }),

  body("items")
    .isArray({ min: 1 })
    .withMessage(
      "At least one item is required"
    ),

  body("items.*.item_id").isMongoId(),

  body("items.*.quantity")
    .isFloat({ gt: 0 }),

  body("items.*.unitPrice")
    .isFloat({ min: 0 }),
];

/* ── Validation Error Handler ───────────────────────────────────── */
export const handleValidation = (
  req,
  res,
  next
) => {
  const errors =
    validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  next();
};
