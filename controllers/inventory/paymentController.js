/**
 * @controller paymentController.js
 * @description Records vendor payments against posted invoices.
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import * as paymentService from "../../services/paymentService.js";
import { MSG } from "../../constants/messages.js";

// ── Record Payment ────────────────────────────────────────────────

export const recordPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, paidAt, notes } = req.body;

  const result = await paymentService.recordPayment({
    hotel_id: req.user.hotel_id,
    invoiceId: req.params.invoiceId,
    amount: parseFloat(amount),
    method,
    reference: reference || "",
    paidAt: paidAt ? new Date(paidAt) : new Date(),
    notes: notes || "",
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    data: result,
    message: MSG.PAYMENT_SUCCESS,
  });
});

// ── Get Payment History ───────────────────────────────────────────

export const getPaymentHistory = asyncHandler(async (req, res) => {
  const payments = await paymentService.getPaymentHistory(
    req.user.hotel_id,
    req.params.invoiceId
  );

  res.json({ success: true, data: payments });
});

// ── Vendor Outstanding ────────────────────────────────────────────

export const getVendorOutstanding = asyncHandler(async (req, res) => {
  const result = await paymentService.getVendorOutstanding(
    req.user.hotel_id,
    req.params.vendorId
  );

  res.json({ success: true, data: result });
});
