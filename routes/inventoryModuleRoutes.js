/**
 * @routes inventory/index.js
 * @description Master router — mounts all sub-routes with auth middleware.
 */

import express from "express";
import { protect, authorize } from "../utils/authMiddleware.js";
import { ROLES } from "../constants/enums.js";

// ── Controllers ───────────────────────────────────────────────────
import * as categoryCtrl from "../controllers/inventory/categoryController.js";
import * as itemCtrl from "../controllers/inventory/inventoryItemController.js";
import * as vendorCtrl from "../controllers/inventory/vendorController.js";
import * as invoiceCtrl from "../controllers/inventory/purchaseInvoiceController.js";
import * as paymentCtrl from "../controllers/inventory/paymentController.js";
import * as stockCtrl from "../controllers/inventory/stockController.js";
import * as adjustmentCtrl from "../controllers/inventory/stockAdjustmentController.js";
import * as ledgerCtrl from "../controllers/inventory/ledgerController.js";
import * as journalCtrl from "../controllers/inventory/journalController.js";
import * as creditNoteCtrl from "../controllers/inventory/creditNoteController.js";
import * as auditCtrl from "../controllers/inventory/auditController.js";
import * as dashboardCtrl from "../controllers/inventory/dashboardController.js";

const router = express.Router();

const GM_MD = [ROLES.GM, ROLES.MD];
const MD = [ROLES.MD];

// Apply JWT protection to all routes
router.use(protect);

// ── Dashboard ─────────────────────────────────────────────────────
router.get("/dashboard", authorize(...GM_MD), dashboardCtrl.getDashboard);

// ── Categories ────────────────────────────────────────────────────
router.get("/categories", authorize(...GM_MD), categoryCtrl.listCategories);
router.post("/categories", authorize(...GM_MD), categoryCtrl.createCategory);
router.put("/categories/:id", authorize(...GM_MD), categoryCtrl.updateCategory);
router.patch(
  "/categories/:id/toggle",
  authorize(...GM_MD),
  categoryCtrl.toggleCategory,
);

// ── Inventory Items ───────────────────────────────────────────────
router.get("/items", authorize(...GM_MD), itemCtrl.listItems);
router.get("/items/:id", authorize(...GM_MD), itemCtrl.getItem);
router.post("/items", authorize(...GM_MD), itemCtrl.createItem);
router.put("/items/:id", authorize(...GM_MD), itemCtrl.updateItem);
router.patch("/items/:id/toggle", authorize(...GM_MD), itemCtrl.toggleItem);
router.get(
  "/items/:id/stock-history",
  authorize(...GM_MD),
  itemCtrl.getStockHistory,
);

// ── Vendors ───────────────────────────────────────────────────────
router.get("/vendors", authorize(...GM_MD), vendorCtrl.listVendors);
router.get("/vendors/:id", authorize(...GM_MD), vendorCtrl.getVendor);
router.post("/vendors", authorize(...GM_MD), vendorCtrl.createVendor);
router.put("/vendors/:id", authorize(...GM_MD), vendorCtrl.updateVendor);
router.patch(
  "/vendors/:id/toggle",
  authorize(...GM_MD),
  vendorCtrl.toggleVendor,
);
router.get(
  "/vendors/:id/ledger",
  authorize(...GM_MD),
  vendorCtrl.getVendorLedger,
);
router.get(
  "/vendors/:vendorId/outstanding",
  authorize(...GM_MD),
  paymentCtrl.getVendorOutstanding,
);

// ── Purchase Invoices ─────────────────────────────────────────────
router.get("/invoices", authorize(...GM_MD), invoiceCtrl.listInvoices);
router.get("/invoices/:id", authorize(...GM_MD), invoiceCtrl.getInvoice);
router.post("/invoices", authorize(...GM_MD), invoiceCtrl.createInvoice);
router.put("/invoices/:id", authorize(...GM_MD), invoiceCtrl.updateInvoice);
router.patch(
  "/invoices/:id/approve",
  authorize(...GM_MD),
  invoiceCtrl.approveInvoice,
);
router.patch(
  "/invoices/:id/post",
  authorize(...GM_MD),
  invoiceCtrl.postInvoice,
);
router.patch(
  "/invoices/:id/cancel",
  authorize(...GM_MD),
  invoiceCtrl.cancelInvoice,
);

// ── Payments ──────────────────────────────────────────────────────
router.post(
  "/invoices/:invoiceId/payments",
  authorize(...GM_MD),
  paymentCtrl.recordPayment,
);
router.get(
  "/invoices/:invoiceId/payments",
  authorize(...GM_MD),
  paymentCtrl.getPaymentHistory,
);

// ── Stock ─────────────────────────────────────────────────────────
router.get("/stock/summary", authorize(...GM_MD), stockCtrl.getStockSummary);
router.get(
  "/stock/transactions",
  authorize(...GM_MD),
  stockCtrl.getTransactions,
);
router.get("/stock/expiry", authorize(...GM_MD), stockCtrl.getExpiryDashboard);
router.post(
  "/stock/mark-expired",
  authorize(...MD),
  stockCtrl.markExpiredBatches,
);

// ── Stock Adjustments ─────────────────────────────────────────────
router.post(
  "/stock/adjustments",
  authorize(...GM_MD),
  adjustmentCtrl.createAdjustment,
);
router.get(
  "/stock/adjustments",
  authorize(...GM_MD),
  adjustmentCtrl.listAdjustments,
);

// ── Credit Notes ──────────────────────────────────────────────────
router.post(
  "/credit-notes",
  authorize(...GM_MD),
  creditNoteCtrl.createCreditNote,
);
router.get(
  "/credit-notes",
  authorize(...GM_MD),
  creditNoteCtrl.listCreditNotes,
);

// ── General Ledger ────────────────────────────────────────────────
router.get("/ledger/accounts", authorize(...GM_MD), ledgerCtrl.listAccounts);
router.post("/ledger/accounts", authorize(...MD), ledgerCtrl.createAccount);
router.post("/ledger/accounts/seed", authorize(...MD), ledgerCtrl.seedAccounts);
router.get(
  "/ledger/trial-balance",
  authorize(...GM_MD),
  ledgerCtrl.getTrialBalance,
);
router.get(
  "/ledger/accounts/:id/drilldown",
  authorize(...GM_MD),
  ledgerCtrl.getAccountDrilldown,
);

// ── Journal Entries ───────────────────────────────────────────────
router.get("/journal", authorize(...GM_MD), journalCtrl.listJournalEntries);
router.get("/journal/:id", authorize(...GM_MD), journalCtrl.getJournalEntry);
router.post("/journal/:id/reverse", authorize(...MD), journalCtrl.reverseEntry);

// ── Audit Trail ───────────────────────────────────────────────────
router.get("/audit", authorize(...GM_MD), auditCtrl.getAuditLogs);

export default router;
