/**
 * @file messages.js
 * @description Centralised error and success message strings.
 *              Keeps controller/service code free of hard-coded strings.
 */
export const MSG = Object.freeze({
  // ── Generic ─────────────────────────────────────────────────
  NOT_FOUND: (entity) => `${entity} not found.`,
  ALREADY_EXISTS: (entity) => `${entity} already exists.`,
  INVALID_STATE: (entity, state) =>
    `${entity} is in '${state}' state and cannot be modified.`,
  FORBIDDEN:
    "You do not have permission to perform this action.",
  UNAUTHORIZED:
    "Authentication required. Please log in.",
  SERVER_ERROR:
    "An unexpected server error occurred. Please try again.",
  VALIDATION_ERROR:
    "Validation failed. Please check your input.",
  MISSING_FIELD: (field) =>
    `Field '${field}' is required.`,
  INVALID_FIELD: (field) =>
    `Field '${field}' contains an invalid value.`,

  // ── Invoice ──────────────────────────────────────────────────
  INVOICE_NOT_FOUND:
    "Purchase invoice not found.",
  INVOICE_ALREADY_POSTED:
    "This invoice has already been posted and is immutable.",
  INVOICE_CANNOT_TRANSITION: (from, to) =>
    `Invoice cannot transition from '${from}' to '${to}'.`,
  INVOICE_POST_SUCCESS:
    "Invoice posted successfully. Stock and ledger updated.",
  INVOICE_APPROVE_SUCCESS:
    "Invoice approved successfully.",
  INVOICE_CANCEL_SUCCESS:
    "Invoice cancelled successfully.",
  INVOICE_NO_ITEMS:
    "Invoice must have at least one line item.",
  INVOICE_PARTIAL_POST_BLOCKED:
    "Partial posting is not allowed. All items must be valid.",

  // ── Stock ────────────────────────────────────────────────────
  INSUFFICIENT_STOCK: (item, avail, req) =>
    `Insufficient stock for '${item}'. Available: ${avail}, Requested: ${req}.`,
  NEGATIVE_STOCK_BLOCKED:
    "Operation would result in negative stock. Blocked.",
  STOCK_IN_SUCCESS:
    "Stock added successfully.",
  STOCK_OUT_SUCCESS:
    "Stock deducted successfully.",
  ADJUSTMENT_SUCCESS:
    "Stock adjustment recorded successfully.",
  BATCH_EXPIRED: (batch) =>
    `Batch '${batch}' is expired and cannot be consumed.`,
  NO_VALID_BATCHES: (item) =>
    `No valid (non-expired) batches available for '${item}'.`,

  // ── Journal / Ledger ─────────────────────────────────────────
  JOURNAL_UNBALANCED: (debit, credit) =>
    `Journal entry is unbalanced. Total Debit: ${debit}, Total Credit: ${credit}.`,
  JOURNAL_IMMUTABLE:
    "Journal entries are immutable. Use a reversal entry to correct.",
  JOURNAL_REVERSED:
    "Journal entry reversed successfully.",
  LEDGER_DIRECT_EDIT:
    "Direct ledger balance manipulation is forbidden.",

  // ── Payment ──────────────────────────────────────────────────
  PAYMENT_OVERPAYMENT: (outstanding) =>
    `Payment amount exceeds outstanding balance of ₹${outstanding.toFixed(
      2
    )}.`,
  PAYMENT_SUCCESS:
    "Payment recorded successfully.",
  PAYMENT_ZERO:
    "Payment amount must be greater than zero.",

  // ── Credit Note ──────────────────────────────────────────────
  CREDIT_NOTE_SUCCESS:
    "Credit note created and journal reversed successfully.",
  CREDIT_NOTE_NOT_POSTED:
    "Credit notes can only be raised against POSTED invoices.",

  // ── Auth ─────────────────────────────────────────────────────
  ROLE_INSUFFICIENT: (required) =>
    `This action requires '${required}' role or higher.`,
  HOTEL_MISMATCH:
    "You can only access resources belonging to your hotel.",
});
