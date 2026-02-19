/**
 * @service paymentService.js
 * @description Manages vendor payment recording against posted invoices.
 *
 * RULES:
 *  1. Payments can only be recorded against POSTED invoices
 *  2. Overpayments are strictly blocked
 *  3. Each payment generates a JournalEntry: AP Dr / Cash or Bank Cr
 *  4. invoice.paidAmount and outstandingAmount are updated atomically
 *  5. paymentStatus is derived: UNPAID / PARTIAL / PAID
 *  6. All operations are atomic within a MongoDB session
 */import mongoose from "mongoose";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";
import * as journalService from "./journalService.js";
import * as auditService from "./auditService.js";

import {
  INVOICE_STATE,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

/* ── Resolve Cash/Bank Ledger Code ─────────────────────────────── */
function getCashOrBankCode(method) {
  const bankMethods = [
    PAYMENT_METHOD.BANK_TRANSFER,
    PAYMENT_METHOD.CHEQUE,
    PAYMENT_METHOD.NEFT,
    PAYMENT_METHOD.RTGS,
    PAYMENT_METHOD.UPI,
  ];

  return bankMethods.includes(method)
    ? DEFAULT_LEDGER_CODES.BANK
    : DEFAULT_LEDGER_CODES.CASH;
}

/* ── Record Vendor Payment ─────────────────────────────────────── */
export async function recordPayment({
  hotel_id,
  invoiceId,
  amount,
  method,
  reference = "",
  paidAt = new Date(),
  notes = "",
  user,
  ipAddress = "",
}) {
  if (!amount || amount <= 0)
    throw new Error(MSG.PAYMENT_ZERO);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await PurchaseInvoice.findOne({
      _id: invoiceId,
      hotel_id,
    }).session(session);

    if (!invoice)
      throw new Error(MSG.INVOICE_NOT_FOUND);

    if (invoice.invoiceState !== INVOICE_STATE.POSTED)
      throw new Error(
        "Payments can only be recorded against POSTED invoices."
      );

    if (invoice.paymentStatus === PAYMENT_STATUS.PAID)
      throw new Error(
        "This invoice is already fully paid."
      );

    const outstanding = invoice.outstandingAmount;

    if (amount > outstanding + 0.005) {
      throw new Error(
        MSG.PAYMENT_OVERPAYMENT(outstanding)
      );
    }

    const paymentAmount = Math.min(
      amount,
      outstanding
    );

    const { DEBIT, CREDIT } =
      JOURNAL_ENTRY_TYPE;

    const cashBankCode =
      getCashOrBankCode(method);

    const journalEntry =
      await journalService.createEntry({
        hotel_id,
        referenceType:
          JOURNAL_REFERENCE_TYPE.PAYMENT,
        reference_id: invoice._id,
        referenceNumber:
          invoice.invoiceNumber,
        lines: [
          {
            accountCode:
              DEFAULT_LEDGER_CODES.ACCOUNTS_PAYABLE,
            entryType: DEBIT,
            amount: paymentAmount,
            description: `Payment to ${invoice.vendorName}: ${invoice.invoiceNumber}`,
          },
          {
            accountCode: cashBankCode,
            entryType: CREDIT,
            amount: paymentAmount,
            description: `${method} payment: ${invoice.invoiceNumber}${
              reference
                ? ` | Ref: ${reference}`
                : ""
            }`,
          },
        ],
        narration: `Vendor payment: ₹${paymentAmount.toFixed(
          2
        )} to ${invoice.vendorName} | Inv: ${
          invoice.invoiceNumber
        }`,
        user,
        session,
      });

    const [payment] = await Payment.create(
      [
        {
          hotel_id,
          invoice_id: invoice._id,
          invoiceNumber:
            invoice.invoiceNumber,
          vendor_id: invoice.vendor_id,
          amount: paymentAmount,
          method,
          reference,
          paidAt,
          journalEntry_id:
            journalEntry._id,
          notes,
          recordedBy: user._id,
        },
      ],
      { session }
    );

    const newPaidAmount = parseFloat(
      (
        invoice.paidAmount +
        paymentAmount
      ).toFixed(2)
    );

    const newOutstanding = parseFloat(
      (
        invoice.grandTotal -
        newPaidAmount
      ).toFixed(2)
    );

    const newPaymentStatus =
      newOutstanding <= 0.005
        ? PAYMENT_STATUS.PAID
        : newPaidAmount > 0
        ? PAYMENT_STATUS.PARTIAL
        : PAYMENT_STATUS.UNPAID;

    await PurchaseInvoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          paidAmount: newPaidAmount,
          outstandingAmount:
            Math.max(0, newOutstanding),
          paymentStatus:
            newPaymentStatus,
          updatedBy: user._id,
        },
      },
      { session }
    );

    await auditService.log({
      hotel_id,
      entityType:
        AUDIT_ENTITY_TYPE.PAYMENT,
      entity_id: payment._id,
      entityReference:
        invoice.invoiceNumber,
      action:
        AUDIT_ACTION.PAYMENT_RECORDED,
      description: `Payment ₹${paymentAmount.toFixed(
        2
      )} recorded via ${method} for invoice ${
        invoice.invoiceNumber
      }. Outstanding: ₹${Math.max(
        0,
        newOutstanding
      ).toFixed(2)}`,
      before: {
        paidAmount: invoice.paidAmount,
        outstandingAmount:
          invoice.outstandingAmount,
        paymentStatus:
          invoice.paymentStatus,
      },
      after: {
        paidAmount: newPaidAmount,
        outstandingAmount:
          Math.max(0, newOutstanding),
        paymentStatus:
          newPaymentStatus,
      },
      user,
      ipAddress,
      session,
    });

    await session.commitTransaction();

    const updatedInvoice =
      await PurchaseInvoice.findById(
        invoice._id
      );

    return { payment, invoice: updatedInvoice };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/* ── Payment History ───────────────────────────────────────────── */
export async function getPaymentHistory(
  hotel_id,
  invoiceId
) {
  return Payment.find({
    hotel_id,
    invoice_id: invoiceId,
  })
    .sort({ paidAt: -1 })
    .populate("recordedBy", "name role");
}

/* ── Vendor Outstanding ────────────────────────────────────────── */
export async function getVendorOutstanding(
  hotel_id,
  vendor_id
) {
  const agg = await PurchaseInvoice.aggregate([
    {
      $match: {
        hotel_id,
        vendor_id:
          new mongoose.Types.ObjectId(
            vendor_id
          ),
        invoiceState:
          INVOICE_STATE.POSTED,
      },
    },
    {
      $group: {
        _id: null,
        totalPosted: {
          $sum: "$grandTotal",
        },
        totalPaid: {
          $sum: "$paidAmount",
        },
        totalOutstanding: {
          $sum: "$outstandingAmount",
        },
      },
    },
  ]);

  if (!agg.length)
    return {
      totalPosted: 0,
      totalPaid: 0,
      outstanding: 0,
    };

  return {
    totalPosted: parseFloat(
      agg[0].totalPosted.toFixed(2)
    ),
    totalPaid: parseFloat(
      agg[0].totalPaid.toFixed(2)
    ),
    outstanding: parseFloat(
      agg[0].totalOutstanding.toFixed(2)
    ),
  };
}
