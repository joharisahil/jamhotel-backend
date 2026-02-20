/**
 * @controller ledgerController.js
 * @description General Ledger endpoints: Chart of Accounts, Trial Balance, Account Drilldown.
 */

import { asyncHandler } from "../../utils/asyncHandler.js";

import LedgerAccount from "../../models/LedgerAccount.js";
import * as ledgerService from "../../services/ledgerService.js";
import { LEDGER_SEEDS } from "../../constants/ledgerSeeds.js";
import { MSG } from "../../constants/messages.js";
import * as auditService from "../../services/auditService.js";

import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../../constants/enums.js";

// ── Chart of Accounts ─────────────────────────────────────────────

export const listAccounts = asyncHandler(async (req, res) => {
  const { type, active } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (type) filter.type = type;
  if (active !== undefined) filter.isActive = active === "true";

  const accounts = await LedgerAccount.find(filter).sort({ code: 1 });

  res.json({ success: true, data: accounts });
});

// ── Trial Balance ─────────────────────────────────────────────────

export const getTrialBalance = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;

  const trialBalance = await ledgerService.getTrialBalance(
    req.user.hotel_id,
    fromDate,
    toDate
  );

  res.json({ success: true, data: trialBalance });
});

// ── Account Drilldown ─────────────────────────────────────────────

export const getAccountDrilldown = asyncHandler(async (req, res) => {
  const { fromDate, toDate, page = 1, limit = 50 } = req.query;

  const result = await ledgerService.getAccountDrilldown({
    hotel_id: req.user.hotel_id,
    account_id: req.params.id,
    fromDate,
    toDate,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({ success: true, data: result });
});

// ── Create Account (Route-level MD only) ─────────────────────────

export const createAccount = asyncHandler(async (req, res) => {
  const account = await LedgerAccount.create({
    hotel_id: req.user.hotel_id,
    ...req.body,
    createdBy: req.user._id,
  });

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.LEDGER_ACCOUNT,
    entity_id: account._id,
    entityReference: account.code,
    action: AUDIT_ACTION.CREATED,
    description: `Ledger account ${account.code} – ${account.name} created`,
    after: account.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: account });
});

// ── Seed Default Chart of Accounts (Route-level MD only) ─────────

export const seedAccounts = asyncHandler(async (req, res) => {
  const existing = await LedgerAccount.countDocuments({
    hotel_id: req.user.hotel_id,
  });

  if (existing > 0) {
    return res.status(400).json({
      success: false,
      message: "Chart of accounts already seeded for this hotel.",
    });
  }

  const docs = LEDGER_SEEDS.map((seed) => ({
    hotel_id: req.user.hotel_id,
    ...seed,
    createdBy: req.user._id,
  }));

  const accounts = await LedgerAccount.insertMany(docs, {
    ordered: false,
  });

  res.status(201).json({
    success: true,
    message: `${accounts.length} accounts seeded.`,
    data: accounts,
  });
});
