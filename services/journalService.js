/**
 * @service journalService.js
 * @description Manages all journal entry operations with strict double-entry enforcement.
 *
 * RULES:
 *  1. Every entry must balance: totalDebit === totalCredit (±₹0.005 tolerance)
 *  2. Entry numbers are sequential and unique per hotel: JE-{YYYY}-{NNNNNN}
 *  3. Entries are immutable — corrections via reversal only
 *  4. Reversal swaps DEBIT↔CREDIT on all lines and marks original as reversed
 *  5. Ledger balances are NEVER stored — always derived via aggregation
 */import mongoose from "mongoose";
import JournalEntry from "../models/JournalEntry.js";
import LedgerAccount from "../models/LedgerAccount.js";
import {
  JOURNAL_ENTRY_TYPE,
  JOURNAL_REFERENCE_TYPE,
  LEDGER_ACCOUNT_TYPE,
} from "../constants/enums.js";
import { MSG } from "../constants/messages.js";

/* ── Sequential Number Generator ────────────────────────────────── */
export async function generateEntryNumber(hotel_id, session) {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;

  const last = await JournalEntry.findOne({
    hotel_id,
    entryNumber: { $regex: `^${prefix}` },
  })
    .sort({ entryNumber: -1 })
    .select("entryNumber")
    .session(session);

  let seq = 1;

  if (last) {
    const parts = last.entryNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(6, "0")}`;
}

/* ── Resolve Account by Code ────────────────────────────────────── */
export async function resolveAccount(hotel_id, code, session) {
  const account = await LedgerAccount.findOne({
    hotel_id,
    code,
    isActive: true,
  }).session(session);

  if (!account) {
    throw new Error(
      `Ledger account '${code}' not found or inactive for this hotel.`
    );
  }

  return account;
}

/* ── Validate Balance ───────────────────────────────────────────── */
function validateBalance(lines) {
  const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

  const totalDebit = lines
    .filter((l) => l.entryType === DEBIT)
    .reduce((s, l) => s + l.amount, 0);

  const totalCredit = lines
    .filter((l) => l.entryType === CREDIT)
    .reduce((s, l) => s + l.amount, 0);

  const diff = Math.abs(totalDebit - totalCredit);

  if (diff > 0.005) {
    throw new Error(
      MSG.JOURNAL_UNBALANCED(
        totalDebit.toFixed(2),
        totalCredit.toFixed(2)
      )
    );
  }

  return { totalDebit, totalCredit };
}

/* ── Create Journal Entry ───────────────────────────────────────── */
export async function createEntry({
  hotel_id,
  referenceType,
  reference_id,
  referenceNumber,
  lines,
  narration = "",
  user,
  session,
}) {
  if (!session)
    throw new Error(
      "journalService.createEntry requires a Mongoose session."
    );

  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const account = await resolveAccount(
        hotel_id,
        line.accountCode,
        session
      );

      return {
        account_id: account._id,
        accountCode: account.code,
        accountName: account.name,
        entryType: line.entryType,
        amount: parseFloat(line.amount.toFixed(2)),
        description: line.description || "",
      };
    })
  );

  const { totalDebit, totalCredit } =
    validateBalance(resolvedLines);

  const entryNumber = await generateEntryNumber(
    hotel_id,
    session
  );

  const [entry] = await JournalEntry.create(
    [
      {
        hotel_id,
        entryNumber,
        referenceType,
        reference_id,
        referenceNumber,
        lines: resolvedLines,
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCredit.toFixed(2)),
        narration,
        createdBy: user._id,
      },
    ],
    { session }
  );

  return entry;
}

/* ── Reverse Journal Entry ──────────────────────────────────────── */
export async function reverseEntry({
  hotel_id,
  originalEntryId,
  narration = "",
  user,
  session,
}) {
  if (!session)
    throw new Error(
      "journalService.reverseEntry requires a Mongoose session."
    );

  const original = await JournalEntry.findOne({
    _id: originalEntryId,
    hotel_id,
  }).session(session);

  if (!original)
    throw new Error(MSG.NOT_FOUND("Journal entry"));

  if (original.isReversed)
    throw new Error(
      "This journal entry has already been reversed."
    );

  const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

  const reversedLines = original.lines.map((line) => ({
    account_id: line.account_id,
    accountCode: line.accountCode,
    accountName: line.accountName,
    entryType: line.entryType === DEBIT ? CREDIT : DEBIT,
    amount: line.amount,
    description: `REVERSAL: ${line.description}`,
  }));

  const entryNumber = await generateEntryNumber(
    hotel_id,
    session
  );

  const [reversalEntry] = await JournalEntry.create(
    [
      {
        hotel_id,
        entryNumber,
        referenceType:
          JOURNAL_REFERENCE_TYPE.REVERSAL,
        reference_id: original._id,
        referenceNumber: `REV-${original.entryNumber}`,
        lines: reversedLines,
        totalDebit: original.totalCredit,
        totalCredit: original.totalDebit,
        narration:
          narration ||
          `Reversal of ${original.entryNumber}`,
        reversalOf: original._id,
        createdBy: user._id,
      },
    ],
    { session }
  );

  await JournalEntry.updateOne(
    { _id: original._id },
    {
      $set: {
        isReversed: true,
        reversalEntry_id: reversalEntry._id,
      },
    },
    { session }
  );

  return reversalEntry;
}

/* ── Get Ledger Balance (Derived) ───────────────────────────────── */
export async function getAccountBalance(
  hotel_id,
  account_id
) {
  const account = await LedgerAccount.findOne({
    _id: account_id,
    hotel_id,
  });

  if (!account)
    throw new Error(MSG.NOT_FOUND("Ledger account"));

  const agg = await JournalEntry.aggregate([
    { $match: { hotel_id, isReversed: false } },
    { $unwind: "$lines" },
    { $match: { "lines.account_id": account._id } },
    {
      $group: {
        _id: "$lines.entryType",
        total: { $sum: "$lines.amount" },
      },
    },
  ]);

  const totals = { DEBIT: 0, CREDIT: 0 };

  agg.forEach((r) => {
    totals[r._id] = r.total;
  });

  const { ASSET, EXPENSE } = LEDGER_ACCOUNT_TYPE;

  const isDebitNormal = [ASSET, EXPENSE].includes(
    account.type
  );

  const balance = isDebitNormal
    ? account.openingBalance +
      totals.DEBIT -
      totals.CREDIT
    : account.openingBalance +
      totals.CREDIT -
      totals.DEBIT;

  return {
    debit: parseFloat(totals.DEBIT.toFixed(2)),
    credit: parseFloat(totals.CREDIT.toFixed(2)),
    balance: parseFloat(balance.toFixed(2)),
  };
}
