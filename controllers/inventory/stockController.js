/**
 * @controller stockController.js
 * @description Read-only stock overview endpoints.
 *              Stock modification ONLY happens via stockService.
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import StockTransaction from "../../models/StockTransaction.js";
import InventoryItem from "../../models/InventoryItem.js";
import InventoryBatch from "../../models/InventoryBatch.js";
import * as stockService from "../../services/stockService.js";
import * as fifoService from "../../services/fifoService.js";

// ── Stock Summary (all items) ─────────────────────────────────────

export const getStockSummary = asyncHandler(async (req, res) => {
  const items = await InventoryItem.find({
    hotel_id: req.user.hotel_id,
    isActive: true,
  }).populate("category_id", "name");

  const summary = await Promise.all(
    items.map(async (item) => {
      const currentStock = await stockService.getCurrentStock(
        req.user.hotel_id,
        item._id
      );

      return {
        item_id: item._id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        category: item.category_id?.name || "",
        currentStock,
        minimumStock: item.minimumStock,
        costPrice: item.costPrice,
        stockValue: parseFloat(
          (currentStock * item.costPrice).toFixed(2)
        ),
        isLowStock: currentStock <= item.minimumStock,
        isPerishable: item.isPerishable,
      };
    })
  );

  const totalValue = summary.reduce((s, i) => s + i.stockValue, 0);
  const lowStockCount = summary.filter((i) => i.isLowStock).length;

  res.json({
    success: true,
    data: summary,
    meta: {
      totalItems: summary.length,
      totalValue: parseFloat(totalValue.toFixed(2)),
      lowStockCount,
    },
  });
});

// ── Transaction Log ───────────────────────────────────────────────

export const getTransactions = asyncHandler(async (req, res) => {
  const {
    item_id,
    type,
    referenceType,
    fromDate,
    toDate,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (item_id) filter.item_id = item_id;
  if (type) filter.type = type;
  if (referenceType) filter.referenceType = referenceType;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await StockTransaction.countDocuments(filter);

  const txns = await StockTransaction.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate("createdBy", "name role");

  res.json({
    success: true,
    data: txns,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
});

// ── Expiry Monitoring ─────────────────────────────────────────────

export const getExpiryDashboard = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const [expiring, expired] = await Promise.all([
    fifoService.getExpiringBatches(
      req.user.hotel_id,
      parseInt(days)
    ),
    InventoryBatch.find({
      hotel_id: req.user.hotel_id,
      isExpired: true,
      isFullyConsumed: false,
      remainingQuantity: { $gt: 0 },
    })
      .populate("item_id", "name sku unit")
      .sort({ expiryDate: 1 }),
  ]);

  res.json({
    success: true,
    data: {
      expiringSoon: expiring,
      expired,
      expiringCount: expiring.length,
      expiredCount: expired.length,
    },
  });
});

// ── Trigger Batch Expiry Mark (MD only via route-level auth) ─────

export const markExpiredBatches = asyncHandler(async (req, res) => {
  const count = await fifoService.markExpiredBatches(
    req.user.hotel_id
  );

  res.json({
    success: true,
    message: `${count} batch(es) marked as expired.`,
  });
});
