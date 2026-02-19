/**
 * @service ledgerService.js
 * @description Aggregation layer for ledger reporting.
 *              Balances are ALWAYS derived from JournalEntry — never stored.
 *
 * Provides:
 *  - Trial Balance
 *  - Account Drilldown (transaction history for a specific account)
 *  - Vendor Ledger (purchases + payments + outstanding)
 *  - P&L and Balance Sheet summary
 */import mongoose from "mongoose";
import JournalEntry from "../models/JournalEntry.js";
import LedgerAccount from "../models/LedgerAccount.js";
import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Payment from "../models/Payment.js";

import {
  LEDGER_ACCOUNT_TYPE,
  JOURNAL_ENTRY_TYPE,
  INVOICE_STATE,
} from "../constants/enums.js";

const { ASSET, EXPENSE } = LEDGER_ACCOUNT_TYPE;
const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

/* ── Trial Balance ─────────────────────────────────────────────── */
export async function getTrialBalance(
  hotel_id,
  fromDate = null,
  toDate = null
) {
  const accounts = await LedgerAccount
    .find({ hotel_id, isActive: true })
    .sort({ code: 1 });

  const accountIds = accounts.map((a) => a._id);

  const matchFilter = { hotel_id };

  if (fromDate || toDate) {
    matchFilter.createdAt = {};
    if (fromDate) matchFilter.createdAt.$gte = new Date(fromDate);
    if (toDate) matchFilter.createdAt.$lte = new Date(toDate);
  }

  const agg = await JournalEntry.aggregate([
    { $match: matchFilter },
    { $unwind: "$lines" },
    { $match: { "lines.account_id": { $in: accountIds } } },
    {
      $group: {
        _id: "$lines.account_id",
        totalDebit: {
          $sum: {
            $cond: [
              { $eq: ["$lines.entryType", DEBIT] },
              "$lines.amount",
              0,
            ],
          },
        },
        totalCredit: {
          $sum: {
            $cond: [
              { $eq: ["$lines.entryType", CREDIT] },
              "$lines.amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalsMap = {};
  agg.forEach((r) => {
    totalsMap[r._id.toString()] = {
      debit: r.totalDebit,
      credit: r.totalCredit,
    };
  });

  return accounts.map((account) => {
    const t =
      totalsMap[account._id.toString()] || {
        debit: 0,
        credit: 0,
      };

    const isDebitNormal = [ASSET, EXPENSE].includes(
      account.type
    );

    const balance = isDebitNormal
      ? account.openingBalance + t.debit - t.credit
      : account.openingBalance + t.credit - t.debit;

    return {
      account_id: account._id,
      code: account.code,
      name: account.name,
      type: account.type,
      openingBalance: account.openingBalance,
      totalDebit: parseFloat(t.debit.toFixed(2)),
      totalCredit: parseFloat(t.credit.toFixed(2)),
      balance: parseFloat(balance.toFixed(2)),
    };
  });
}

/* ── Account Drilldown ─────────────────────────────────────────── */
export async function getAccountDrilldown({
  hotel_id,
  account_id,
  fromDate,
  toDate,
  page = 1,
  limit = 50,
}) {
  const account = await LedgerAccount.findOne({
    _id: account_id,
    hotel_id,
  });

  if (!account) throw new Error("Ledger account not found");

  const matchFilter = { hotel_id };

  if (fromDate || toDate) {
    matchFilter.createdAt = {};
    if (fromDate) matchFilter.createdAt.$gte = new Date(fromDate);
    if (toDate) matchFilter.createdAt.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;

  const agg = await JournalEntry.aggregate([
    { $match: matchFilter },
    { $unwind: "$lines" },
    {
      $match: {
        "lines.account_id":
          new mongoose.Types.ObjectId(account_id),
      },
    },
    { $sort: { createdAt: 1 } },
    {
      $project: {
        entryNumber: 1,
        referenceType: 1,
        referenceNumber: 1,
        narration: 1,
        createdAt: 1,
        isReversed: 1,
        lineAmount: "$lines.amount",
        lineEntryType: "$lines.entryType",
        lineDescription: "$lines.description",
      },
    },
    { $skip: skip },
    { $limit: limit },
  ]);

  const isDebitNormal = [ASSET, EXPENSE].includes(
    account.type
  );

  let runningBalance = account.openingBalance;

  const entries = agg.map((e) => {
    const movement = isDebitNormal
      ? e.lineEntryType === DEBIT
        ? e.lineAmount
        : -e.lineAmount
      : e.lineEntryType === CREDIT
      ? e.lineAmount
      : -e.lineAmount;

    runningBalance += movement;

    return {
      ...e,
      runningBalance: parseFloat(
        runningBalance.toFixed(2)
      ),
    };
  });

  return {
    account,
    entries,
    runningBalance: parseFloat(
      runningBalance.toFixed(2)
    ),
  };
}

/* ── Vendor Ledger ─────────────────────────────────────────────── */
export async function getVendorLedger(
  hotel_id,
  vendor_id,
  fromDate = null,
  toDate = null
) {
  const dateFilter = {};

  if (fromDate || toDate) {
    dateFilter.createdAt = {};
    if (fromDate)
      dateFilter.createdAt.$gte = new Date(fromDate);
    if (toDate)
      dateFilter.createdAt.$lte = new Date(toDate);
  }

  const [invoices, payments] = await Promise.all([
    PurchaseInvoice.find({
      hotel_id,
      vendor_id,
      invoiceState: INVOICE_STATE.POSTED,
      ...dateFilter,
    })
      .sort({ createdAt: 1 })
      .select(
        "invoiceNumber grandTotal paidAmount outstandingAmount paymentStatus createdAt"
      ),

    Payment.find({
      hotel_id,
      vendor_id,
      ...dateFilter,
    })
      .sort({ paidAt: 1 })
      .select(
        "amount method reference paidAt invoiceNumber"
      ),
  ]);

  const ledgerRows = [];
  let runningBalance = 0;

  const allEvents = [
    ...invoices.map((inv) => ({
      date: inv.createdAt,
      type: "PURCHASE",
      reference: inv.invoiceNumber,
      debit: inv.grandTotal,
      credit: 0,
      document: inv,
    })),
    ...payments.map((pay) => ({
      date: pay.paidAt,
      type: "PAYMENT",
      reference: pay.invoiceNumber,
      debit: 0,
      credit: pay.amount,
      document: pay,
    })),
  ].sort(
    (a, b) =>
      new Date(a.date) - new Date(b.date)
  );

  for (const event of allEvents) {
    runningBalance += event.debit - event.credit;

    ledgerRows.push({
      ...event,
      runningBalance: parseFloat(
        runningBalance.toFixed(2)
      ),
    });
  }

  const totals = invoices.reduce(
    (acc, inv) => ({
      totalPurchases:
        acc.totalPurchases + inv.grandTotal,
      totalPaid:
        acc.totalPaid + inv.paidAmount,
      totalOutstanding:
        acc.totalOutstanding +
        inv.outstandingAmount,
    }),
    {
      totalPurchases: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    }
  );

  return {
    ledgerRows,
    summary: {
      totalPurchases: parseFloat(
        totals.totalPurchases.toFixed(2)
      ),
      totalPaid: parseFloat(
        totals.totalPaid.toFixed(2)
      ),
      outstanding: parseFloat(
        totals.totalOutstanding.toFixed(2)
      ),
    },
  };
}
