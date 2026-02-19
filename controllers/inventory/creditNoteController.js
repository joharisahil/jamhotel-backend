/**
 * @controller creditNoteController.js
 * @description Creates credit notes against POSTED invoices.
 */

import mongoose from "mongoose";
import CreditNote from "../../models/CreditNote.js";
import PurchaseInvoice from "../../models/PurchaseInvoice.js";
import * as journalService from "../../services/journalService.js";
import * as stockService from "../../services/stockService.js";
import * as auditService from "../../services/auditService.js";
import * as taxService from "../../services/taxService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import {
  INVOICE_STATE,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  REFERENCE_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

// ── Generate Credit Note Number ───────────────────────
const generateCNNumber = async (hotel_id) => {
  const year = new Date().getFullYear();
  const prefix = `CN-${year}-`;

  const last = await CreditNote.findOne({
    hotel_id,
    creditNoteNumber: { $regex: `^${prefix}` },
  })
    .sort({ creditNoteNumber: -1 })
    .select("creditNoteNumber");

  const seq = last
    ? parseInt(last.creditNoteNumber.split("-").pop(), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(5, "0")}`;
};

// ── Create Credit Note ────────────────────────────────
export const createCreditNote = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { originalInvoiceId, items, reason } = req.body;

    const invoice = await PurchaseInvoice.findOne({
      _id: originalInvoiceId,
      hotel_id: req.user.hotel_id,
    }).session(session);

    if (!invoice) throw new Error(MSG.INVOICE_NOT_FOUND);
    if (invoice.invoiceState !== INVOICE_STATE.POSTED)
      throw new Error(MSG.CREDIT_NOTE_NOT_POSTED);

    const calc = taxService.calculateInvoiceTotals(items);
    const cnNum = await generateCNNumber(req.user.hotel_id);
    const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

    const journalEntry = await journalService.createEntry({
      hotel_id: req.user.hotel_id,
      referenceType: JOURNAL_REFERENCE_TYPE.CREDIT_NOTE,
      reference_id: invoice._id,
      referenceNumber: cnNum,
      lines: [
        {
          accountCode: DEFAULT_LEDGER_CODES.ACCOUNTS_PAYABLE,
          entryType: DEBIT,
          amount: calc.grandTotal,
          description: `Credit note ${cnNum} — reduces payable`,
        },
        {
          accountCode: DEFAULT_LEDGER_CODES.INVENTORY_ASSET,
          entryType: CREDIT,
          amount: calc.subtotal,
          description: `Inventory reduction: ${cnNum}`,
        },
        ...(calc.taxBreakdown.cgst > 0
          ? [{
              accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_CGST,
              entryType: CREDIT,
              amount: calc.taxBreakdown.cgst,
              description: `CGST reversal: ${cnNum}`,
            }]
          : []),
        ...(calc.taxBreakdown.sgst > 0
          ? [{
              accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_SGST,
              entryType: CREDIT,
              amount: calc.taxBreakdown.sgst,
              description: `SGST reversal: ${cnNum}`,
            }]
          : []),
        ...(calc.taxBreakdown.igst > 0
          ? [{
              accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_IGST,
              entryType: CREDIT,
              amount: calc.taxBreakdown.igst,
              description: `IGST reversal: ${cnNum}`,
            }]
          : []),
      ],
      narration: `Credit note ${cnNum} against ${invoice.invoiceNumber}`,
      user: req.user,
      session,
    });

    const enrichedItems = [];

    for (const lineItem of calc.items) {
      if (lineItem.restoreStock === false) {
        await stockService.stockOut({
          hotel_id: req.user.hotel_id,
          item_id: lineItem.item_id,
          quantity: lineItem.quantity,
          referenceType: REFERENCE_TYPE.CREDIT_NOTE,
          reference_id: null,
          notes: `Return to vendor: ${cnNum}`,
          user: req.user,
          session,
        });
      }

      enrichedItems.push({ ...lineItem });
    }

    const [creditNote] = await CreditNote.create(
      [{
        hotel_id: req.user.hotel_id,
        creditNoteNumber: cnNum,
        originalInvoice_id: invoice._id,
        originalInvoiceNumber: invoice.invoiceNumber,
        vendor_id: invoice.vendor_id,
        vendorName: invoice.vendorName,
        items: enrichedItems,
        subtotal: calc.subtotal,
        gstAmount: calc.gstAmount,
        grandTotal: calc.grandTotal,
        reason,
        journalEntry_id: journalEntry._id,
        createdBy: req.user._id,
      }],
      { session }
    );

    await auditService.log({
      hotel_id: req.user.hotel_id,
      entityType: AUDIT_ENTITY_TYPE.CREDIT_NOTE,
      entity_id: creditNote._id,
      entityReference: cnNum,
      action: AUDIT_ACTION.CREATED,
      description: `Credit note ${cnNum} created`,
      after: creditNote.toObject(),
      user: req.user,
      ipAddress: req.ip,
      session,
    });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: creditNote,
      message: MSG.CREDIT_NOTE_SUCCESS,
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── List Credit Notes ────────────────────────────────
export const listCreditNotes = asyncHandler(async (req, res) => {
  const { vendor_id, fromDate, toDate, page = 1, limit = 20 } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (vendor_id) filter.vendor_id = vendor_id;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const total = await CreditNote.countDocuments(filter);

  const notes = await CreditNote.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate("createdBy", "name role");

  res.json({
    success: true,
    data: notes,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});
