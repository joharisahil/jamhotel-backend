/**
 * @service invoicePostingService.js
 * @description Handles the APPROVED → POSTED transition for purchase invoices.
 *
 * ATOMIC OPERATION — all steps run inside a single MongoDB session:
 *  1. Validate invoice state (must be APPROVED)
 *  2. Recalculate and verify all financial totals (server-side)
 *  3. For each line item:
 *     a. If perishable: create InventoryBatch, then stockIn via batch reference
 *     b. If non-perishable: stockIn directly
 *     c. Create StockTransaction (IN)
 *  4. Create balanced JournalEntry:
 *       Dr  Inventory Account    (subtotal)
 *       Dr  Input GST – CGST     (cgstAmount, if applicable)
 *       Dr  Input GST – SGST     (sgstAmount, if applicable)
 *       Dr  Input GST – IGST     (igstAmount, if applicable)
 *       Cr  Accounts Payable     (grandTotal)
 *  5. Update invoice: state = POSTED, journalEntry_id, outstandingAmount
 *  6. Log audit entry
 *  7. Commit session
 *
 * On any failure → session.abortTransaction()
 */import mongoose from "mongoose";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import InventoryBatch from "../models/InventoryBatch.js";
import InventoryItem from "../models/InventoryItem.js";
import * as journalService from "./journalService.js";
import * as stockService from "./stockService.js";
import * as taxService from "./taxService.js";
import * as auditService from "./auditService.js";

import {
  INVOICE_STATE,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  REFERENCE_TYPE,
  DEFAULT_LEDGER_CODES,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

/**
 * Posts a purchase invoice atomically.
 */
export async function postInvoice({
  hotel_id,
  invoiceId,
  user,
  ipAddress = "",
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── Step 1: Load and validate invoice ────────────────────────
    const invoice = await PurchaseInvoice.findOne({
      _id: invoiceId,
      hotel_id,
    }).session(session);

    if (!invoice) throw new Error(MSG.INVOICE_NOT_FOUND);

    if (invoice.invoiceState !== INVOICE_STATE.APPROVED)
      throw new Error(
        MSG.INVOICE_CANNOT_TRANSITION(
          invoice.invoiceState,
          INVOICE_STATE.POSTED
        )
      );

    if (!invoice.items || invoice.items.length === 0)
      throw new Error(MSG.INVOICE_NO_ITEMS);

    const beforeSnapshot = invoice.toObject();

    // ── Step 2: Server-side total recalculation ───────────────────
    const recalc = taxService.calculateInvoiceTotals(
      invoice.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        gstPercentage: i.gstPercentage,
      })),
      false
    );

    const tolerance = 0.05;
    if (Math.abs(recalc.grandTotal - invoice.grandTotal) > tolerance) {
      throw new Error(
        `Invoice total mismatch. Stored: ₹${invoice.grandTotal}, Calculated: ₹${recalc.grandTotal}. Please re-save the draft.`
      );
    }

    // ── Step 3: Process line items ────────────────────────────────
    for (let i = 0; i < invoice.items.length; i++) {
      const lineItem = invoice.items[i];

      const item = await InventoryItem.findOne({
        _id: lineItem.item_id,
        hotel_id,
      }).session(session);

      if (!item)
        throw new Error(MSG.NOT_FOUND(`Item '${lineItem.itemName}'`));

      let batch_id = null;
      let batchNumber = "";

      if (lineItem.isPerishable) {
        if (!lineItem.batchNumber)
          throw new Error(
            `Batch number required for perishable item '${item.name}'.`
          );

        if (!lineItem.expiryDate)
          throw new Error(
            `Expiry date required for perishable item '${item.name}'.`
          );

        const [batch] = await InventoryBatch.create(
          [
            {
              hotel_id,
              item_id: item._id,
              invoice_id: invoice._id,
              batchNumber: lineItem.batchNumber,
              expiryDate: lineItem.expiryDate,
              receivedDate: new Date(),
              receivedQuantity: lineItem.quantity,
              remainingQuantity: lineItem.quantity,
              unitCost: lineItem.unitPrice,
            },
          ],
          { session }
        );

        batch_id = batch._id;
        batchNumber = batch.batchNumber;
      }

      await stockService.stockIn({
        hotel_id,
        item_id: item._id,
        quantity: lineItem.quantity,
        referenceType: REFERENCE_TYPE.PURCHASE,
        reference_id: invoice._id,
        batch_id,
        batchNumber,
        notes: `Purchase posting: Invoice ${invoice.invoiceNumber}`,
        user,
        session,
      });
    }

    // ── Step 4: Journal Entry ─────────────────────────────────────
    const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;
    const journalLines = [];

    journalLines.push({
      accountCode: DEFAULT_LEDGER_CODES.INVENTORY_ASSET,
      entryType: DEBIT,
      amount: invoice.subtotal,
      description: `Inventory purchase: ${invoice.invoiceNumber}`,
    });

    if (invoice.taxBreakdown.cgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_CGST,
        entryType: DEBIT,
        amount: invoice.taxBreakdown.cgst,
        description: `CGST Input: ${invoice.invoiceNumber}`,
      });
    }

    if (invoice.taxBreakdown.sgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_SGST,
        entryType: DEBIT,
        amount: invoice.taxBreakdown.sgst,
        description: `SGST Input: ${invoice.invoiceNumber}`,
      });
    }

    if (invoice.taxBreakdown.igst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_INPUT_IGST,
        entryType: DEBIT,
        amount: invoice.taxBreakdown.igst,
        description: `IGST Input: ${invoice.invoiceNumber}`,
      });
    }

    journalLines.push({
      accountCode: DEFAULT_LEDGER_CODES.ACCOUNTS_PAYABLE,
      entryType: CREDIT,
      amount: invoice.grandTotal,
      description: `Payable to ${invoice.vendorName}: ${invoice.invoiceNumber}`,
    });

    const journalEntry = await journalService.createEntry({
      hotel_id,
      referenceType: JOURNAL_REFERENCE_TYPE.PURCHASE_INVOICE,
      reference_id: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      lines: journalLines,
      narration: `Purchase invoice posted: ${invoice.invoiceNumber} | Vendor: ${invoice.vendorName}`,
      user,
      session,
    });

    // ── Step 5: Update invoice ────────────────────────────────────
    const stateLogEntry = {
      from: INVOICE_STATE.APPROVED,
      to: INVOICE_STATE.POSTED,
      by: user._id,
      at: new Date(),
      note: "Invoice posted — stock and ledger updated",
    };

    await PurchaseInvoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          invoiceState: INVOICE_STATE.POSTED,
          journalEntry_id: journalEntry._id,
          outstandingAmount: invoice.grandTotal,
          postedBy: user._id,
          postedAt: new Date(),
          updatedBy: user._id,
        },
        $push: { stateLog: stateLogEntry },
      },
      { session }
    );

    // ── Step 6: Audit log ─────────────────────────────────────────
    await auditService.log({
      hotel_id,
      entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
      entity_id: invoice._id,
      entityReference: invoice.invoiceNumber,
      action: AUDIT_ACTION.POSTED,
      description: `Invoice ${invoice.invoiceNumber} posted. Stock updated for ${invoice.items.length} item(s). Journal: ${journalEntry.entryNumber}`,
      before: beforeSnapshot,
      after: {
        invoiceState: INVOICE_STATE.POSTED,
        journalEntry_id: journalEntry._id,
      },
      user,
      ipAddress,
      session,
    });

    await session.commitTransaction();

    return PurchaseInvoice.findById(invoice._id).populate(
      "vendor_id",
      "name gstin"
    );
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
