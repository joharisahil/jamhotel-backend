/**
 * @controller purchaseInvoiceController.js
 * @description Purchase invoice lifecycle:
 *              DRAFT → APPROVED → POSTED → CANCELLED
 *              Posting handled by invoicePostingService (atomic).
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";

import PurchaseInvoice from "../../models/PurchaseInvoice.js";
import Vendor from "../../models/Vendor.js";

import * as invoicePosting from "../../services/invoicePostingService.js";
import * as taxService from "../../services/taxService.js";
import * as auditService from "../../services/auditService.js";

import {
  INVOICE_STATE,
  INVOICE_TRANSITIONS,
  PAYMENT_STATUS,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../../constants/enums.js";

import { MSG } from "../../constants/messages.js";


// ─────────────────────────────────────────────────────────
// Sequential Invoice Number
// ─────────────────────────────────────────────────────────

const generateInvoiceNumber = async (hotel_id) => {
  const year = new Date().getFullYear();
  const prefix = `PI-${year}-`;

  const last = await PurchaseInvoice.findOne({
    hotel_id,
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  const seq = last
    ? parseInt(last.invoiceNumber.split("-").pop(), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(5, "0")}`;
};


// ─────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────

export const listInvoices = asyncHandler(async (req, res) => {
  const {
    state,
    vendor_id,
    paymentStatus,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (state) filter.invoiceState = state;
  if (vendor_id) filter.vendor_id = vendor_id;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const total = await PurchaseInvoice.countDocuments(filter);

  const invoices = await PurchaseInvoice.find(filter)
    .populate("vendor_id", "name gstin")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: invoices,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});


// ─────────────────────────────────────────────────────────
// Get Single
// ─────────────────────────────────────────────────────────

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  }).populate("vendor_id createdBy approvedBy postedBy");

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Create Draft
// ─────────────────────────────────────────────────────────

export const createInvoice = asyncHandler(async (req, res) => {
  const { vendorId, items, notes } = req.body;

  if (!items || items.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: MSG.INVOICE_NO_ITEMS });
  }

  const vendor = await Vendor.findOne({
    _id: vendorId,
    hotel_id: req.user.hotel_id,
  });

  if (!vendor) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
  }

  const calc = taxService.calculateInvoiceTotals(items);
  const invoiceNumber = await generateInvoiceNumber(req.user.hotel_id);

  const invoice = await PurchaseInvoice.create({
    hotel_id: req.user.hotel_id,
    invoiceNumber,
    vendor_id: vendor._id,
    vendorName: vendor.name,
    items: calc.items,
    subtotal: calc.subtotal,
    gstAmount: calc.gstAmount,
    taxBreakdown: calc.taxBreakdown,
    grandTotal: calc.grandTotal,
    outstandingAmount: calc.grandTotal,
    invoiceState: INVOICE_STATE.DRAFT,
    paymentStatus: PAYMENT_STATUS.UNPAID,
    notes: notes || "",
    createdBy: req.user._id,
    stateLog: [
      {
        to: INVOICE_STATE.DRAFT,
        by: req.user._id,
        note: "Invoice created",
      },
    ],
  });

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoiceNumber,
    action: AUDIT_ACTION.CREATED,
    description: `Draft invoice ${invoiceNumber} created. Total ₹${calc.grandTotal}`,
    after: invoice.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Update Draft
// ─────────────────────────────────────────────────────────

export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  if (invoice.invoiceState !== INVOICE_STATE.DRAFT) {
    return res.status(400).json({
      success: false,
      message: MSG.INVALID_STATE("Invoice", invoice.invoiceState),
    });
  }

  const before = invoice.toObject();
  const { items, notes, vendor_id } = req.body;

  if (items && items.length > 0) {
    const calc = taxService.calculateInvoiceTotals(items);
    invoice.items = calc.items;
    invoice.subtotal = calc.subtotal;
    invoice.gstAmount = calc.gstAmount;
    invoice.taxBreakdown = calc.taxBreakdown;
    invoice.grandTotal = calc.grandTotal;
    invoice.outstandingAmount = calc.grandTotal;
  }

  if (notes !== undefined) invoice.notes = notes;

  if (vendor_id) {
    const vendor = await Vendor.findOne({
      _id: vendor_id,
      hotel_id: req.user.hotel_id,
    });

    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
    }

    invoice.vendor_id = vendor._id;
    invoice.vendorName = vendor.name;
  }

  invoice.updatedBy = req.user._id;
  await invoice.save();

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.UPDATED,
    description: `Draft invoice ${invoice.invoiceNumber} updated`,
    before,
    after: invoice.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Approve
// ─────────────────────────────────────────────────────────

export const approveInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  const allowed = INVOICE_TRANSITIONS[invoice.invoiceState];

  if (!allowed.includes(INVOICE_STATE.APPROVED)) {
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_CANNOT_TRANSITION(
        invoice.invoiceState,
        INVOICE_STATE.APPROVED
      ),
    });
  }

  const before = invoice.toObject();

  invoice.invoiceState = INVOICE_STATE.APPROVED;
  invoice.approvedBy = req.user._id;
  invoice.approvedAt = new Date();
  invoice.updatedBy = req.user._id;

  invoice.stateLog.push({
    from: before.invoiceState,
    to: INVOICE_STATE.APPROVED,
    by: req.user._id,
    note: req.body.note || "",
  });

  await invoice.save();

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.APPROVED,
    description: `Invoice ${invoice.invoiceNumber} approved`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Post (Atomic)
// ─────────────────────────────────────────────────────────

export const postInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoicePosting.postInvoice({
    hotel_id: req.user.hotel_id,
    invoiceId: req.params.id,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    data: invoice,
    message: MSG.INVOICE_POST_SUCCESS,
  });
});


// ─────────────────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────────────────

export const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  const allowed = INVOICE_TRANSITIONS[invoice.invoiceState];

  if (!allowed.includes(INVOICE_STATE.CANCELLED)) {
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_CANNOT_TRANSITION(
        invoice.invoiceState,
        INVOICE_STATE.CANCELLED
      ),
    });
  }

  if (invoice.invoiceState === INVOICE_STATE.POSTED) {
    return res.status(400).json({
      success: false,
      message:
        "Posted invoices cannot be cancelled directly. Use a credit note.",
    });
  }

  const before = invoice.toObject();

  invoice.invoiceState = INVOICE_STATE.CANCELLED;
  invoice.cancelledBy = req.user._id;
  invoice.cancelledAt = new Date();
  invoice.cancellationReason = req.body.reason || "";
  invoice.updatedBy = req.user._id;

  invoice.stateLog.push({
    from: before.invoiceState,
    to: INVOICE_STATE.CANCELLED,
    by: req.user._id,
    note: req.body.reason || "",
  });

  await invoice.save();

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.CANCELLED,
    description: `Invoice ${invoice.invoiceNumber} cancelled`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    data: invoice,
    message: MSG.INVOICE_CANCEL_SUCCESS,
  });
});
