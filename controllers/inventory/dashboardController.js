/**
 * @controller dashboardController.js
 * @description Inventory and financial KPI summary for the dashboard.
 *              All figures are derived — never cached in DB.
 */

import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler.js";

import InventoryItem from "../../models/InventoryItem.js";
import PurchaseInvoice from "../../models/PurchaseInvoice.js";
import StockTransaction from "../../models/StockTransaction.js";
import InventoryBatch from "../../models/InventoryBatch.js";

import * as stockService from "../../services/stockService.js";

import { INVOICE_STATE, PAYMENT_STATUS } from "../../constants/enums.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;

  const now = new Date();
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(now.getDate() + 30);

  const [
    items,
    pendingInvoices,
    postedUnpaid,
    expiringBatches,
    expiredBatches,
    recentTransactions,
  ] = await Promise.all([
    InventoryItem.find({ hotel_id, isActive: true }),

    PurchaseInvoice.countDocuments({
      hotel_id,
      invoiceState: {
        $in: [INVOICE_STATE.DRAFT, INVOICE_STATE.APPROVED],
      },
    }),

    PurchaseInvoice.aggregate([
      {
        $match: {
          hotel_id: new mongoose.Types.ObjectId(hotel_id),
          invoiceState: INVOICE_STATE.POSTED,
          paymentStatus: { $ne: PAYMENT_STATUS.PAID },
        },
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]),

    InventoryBatch.countDocuments({
      hotel_id,
      isExpired: false,
      isFullyConsumed: false,
      expiryDate: { $gte: now, $lte: thirtyDaysAhead },
      remainingQuantity: { $gt: 0 },
    }),

    InventoryBatch.countDocuments({
      hotel_id,
      isExpired: true,
      isFullyConsumed: false,
      remainingQuantity: { $gt: 0 },
    }),

    StockTransaction.find({ hotel_id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("createdBy", "name"),
  ]);

  // ── Derive stock values ──────────────────────────────

  let totalStockValue = 0;
  let lowStockCount = 0;

  await Promise.all(
    items.map(async (item) => {
      const stock = await stockService.getCurrentStock(
        hotel_id,
        item._id
      );

      totalStockValue += stock * item.costPrice;

      if (stock <= item.minimumStock) {
        lowStockCount++;
      }
    })
  );

  const totalPayable =
    postedUnpaid.length > 0
      ? postedUnpaid[0].totalOutstanding
      : 0;

  res.json({
    success: true,
    data: {
      totalItems: items.length,
      lowStockItems: lowStockCount,
      totalStockValue: Number(totalStockValue.toFixed(2)),
      pendingInvoices,
      expiringCount: expiringBatches,
      expiredCount: expiredBatches,
      totalPayable: Number(totalPayable.toFixed(2)),
      recentTransactions,
    },
  });
});
