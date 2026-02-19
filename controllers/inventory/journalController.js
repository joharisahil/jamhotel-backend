/**
 * @controller journalController.js
 * @description Journal entry management: list, get, and MD-only reversal.
 */

import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";

import JournalEntry from "../../models/JournalEntry.js";
import * as journalService from "../../services/journalService.js";
import * as auditService from "../../services/auditService.js";

import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.js";

// ── List ─────────────────────────────────────────────────────────

export const listJournalEntries = asyncHandler(async (req, res) => {
  const {
    referenceType,
    isReversed,
    fromDate,
    toDate,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (referenceType) filter.referenceType = referenceType;
  if (isReversed !== undefined)
    filter.isReversed = isReversed === "true";

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const total = await JournalEntry.countDocuments(filter);

  const entries = await JournalEntry.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate("createdBy", "name role");

  res.json({
    success: true,
    data: entries,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});

// ── Get Single ───────────────────────────────────────────────────

export const getJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  })
    .populate("createdBy", "name role")
    .populate("reversalOf reversalEntry_id");

  if (!entry) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Journal entry") });
  }

  res.json({ success: true, data: entry });
});

// ── Reverse Entry (Route-level MD only) ─────────────────────────

export const reverseEntry = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const original = await JournalEntry.findOne({
      _id: req.params.id,
      hotel_id: req.user.hotel_id,
    }).session(session);

    if (!original) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: MSG.NOT_FOUND("Journal entry"),
      });
    }

    const reversal = await journalService.reverseEntry({
      hotel_id: req.user.hotel_id,
      originalEntryId: req.params.id,
      narration: req.body.narration || "",
      user: req.user,
      session,
    });

    await auditService.log({
      hotel_id: req.user.hotel_id,
      entityType: AUDIT_ENTITY_TYPE.JOURNAL_ENTRY,
      entity_id: original._id,
      entityReference: original.entryNumber,
      action: AUDIT_ACTION.REVERSED,
      description: `Journal entry ${original.entryNumber} reversed. Reversal: ${reversal.entryNumber}`,
      before: { isReversed: false },
      after: {
        isReversed: true,
        reversalEntry_id: reversal._id,
      },
      user: req.user,
      ipAddress: req.ip,
      session,
    });

    await session.commitTransaction();

    res.json({
      success: true,
      data: reversal,
      message: MSG.JOURNAL_REVERSED,
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});
