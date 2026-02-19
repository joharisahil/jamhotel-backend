/**
 * @controller stockAdjustmentController.js
 * @description Handles manual stock adjustments with reason codes and audit trail.
 */

import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";
import StockAdjustment from "../../models/StockAdjustment.js";
import InventoryItem from "../../models/InventoryItem.js";
import * as stockService from "../../services/stockService.js";
import * as auditService from "../../services/auditService.js";

import {
  REFERENCE_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../../constants/enums.js";

import { MSG } from "../../constants/messages.js";

// ── Create Adjustment ─────────────────────────────────────────────

export const createAdjustment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { item_id, type, quantity, reason, notes } = req.body;

    const item = await InventoryItem.findOne({
      _id: item_id,
      hotel_id: req.user.hotel_id,
    }).session(session);

    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: MSG.NOT_FOUND("Item"),
      });
    }

    // Record stock movement
    const { transaction, balanceBefore, balanceAfter } =
      await stockService.stockAdjust({
        hotel_id: req.user.hotel_id,
        item_id: item._id,
        adjustmentType: type,
        quantity: parseFloat(quantity),
        referenceType: REFERENCE_TYPE.ADJUSTMENT,
        notes,
        user: req.user,
        session,
      });

    // Create adjustment record
    const [adjustment] = await StockAdjustment.create(
      [
        {
          hotel_id: req.user.hotel_id,
          item_id: item._id,
          itemName: item.name,
          itemSku: item.sku,
          type,
          quantity: parseFloat(quantity),
          reason,
          notes,
          balanceBefore,
          balanceAfter,
          stockTransaction_id: transaction._id,
          adjustedBy: req.user._id,
        },
      ],
      { session }
    );

    await auditService.log({
      hotel_id: req.user.hotel_id,
      entityType: AUDIT_ENTITY_TYPE.STOCK_ADJUSTMENT,
      entity_id: adjustment._id,
      entityReference: item.sku,
      action: AUDIT_ACTION.ADJUSTED,
      description: `Stock ${type} adjustment: ${quantity} × ${item.name} | Reason: ${reason} | Balance: ${balanceBefore} → ${balanceAfter}`,
      before: { stock: balanceBefore },
      after: { stock: balanceAfter },
      user: req.user,
      ipAddress: req.ip,
      session,
    });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: adjustment,
      message: MSG.ADJUSTMENT_SUCCESS,
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── List Adjustments ──────────────────────────────────────────────

export const listAdjustments = asyncHandler(async (req, res) => {
  const { item_id, reason, fromDate, toDate, page = 1, limit = 50 } =
    req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (item_id) filter.item_id = item_id;
  if (reason) filter.reason = reason;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await StockAdjustment.countDocuments(filter);

  const adjustments = await StockAdjustment.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate("adjustedBy", "name role")
    .populate("item_id", "name sku unit");

  res.json({
    success: true,
    data: adjustments,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});
