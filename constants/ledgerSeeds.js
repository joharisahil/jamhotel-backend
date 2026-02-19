/**
 * @file ledgerSeeds.js
 * @description Default Chart of Accounts seeded per hotel on first setup.
 *              These are the accounts used by invoicePostingService and journalService.
 *              hotel_id is injected at seed time.
 */
/**
 * @file ledgerSeeds.js
 * @description Default Chart of Accounts seeded per hotel on first setup.
 */

import { LEDGER_ACCOUNT_TYPE } from "./enums.js";

export const LEDGER_SEEDS = [
  // ── ASSETS ──────────────────────────────────────────────────
  { code: "1010", name: "Cash in Hand",            type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Physical cash held at property" },
  { code: "1020", name: "Bank Account",            type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Primary operating bank account" },
  { code: "1100", name: "Inventory / Stock",       type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Stores and F&B inventory value" },
  { code: "1110", name: "Food Inventory",          type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Perishable food stock" },
  { code: "1120", name: "Beverage Inventory",      type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Beverage stock (alcoholic & non-alcoholic)" },
  { code: "1130", name: "Housekeeping Supplies",   type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Housekeeping consumables" },
  { code: "1200", name: "GST Input Tax Credit",    type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Aggregate input tax credit" },
  { code: "1210", name: "Input GST – CGST",        type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Central GST recoverable" },
  { code: "1220", name: "Input GST – SGST",        type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "State GST recoverable" },
  { code: "1230", name: "Input GST – IGST",        type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Integrated GST recoverable" },
  { code: "1300", name: "Accounts Receivable",     type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Amounts owed by guests/corporates" },
  { code: "1400", name: "Prepaid Expenses",        type: LEDGER_ACCOUNT_TYPE.ASSET,     description: "Prepaid insurance, rent, etc." },

  // ── LIABILITIES ──────────────────────────────────────────────
  { code: "2100", name: "Accounts Payable",        type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "Amounts owed to vendors" },
  { code: "2110", name: "GST Payable – CGST",      type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "CGST collected on sales" },
  { code: "2120", name: "GST Payable – SGST",      type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "SGST collected on sales" },
  { code: "2130", name: "GST Payable – IGST",      type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "IGST collected on sales" },
  { code: "2200", name: "TDS Payable",             type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "Tax deducted at source payable" },
  { code: "2300", name: "Advance from Guests",     type: LEDGER_ACCOUNT_TYPE.LIABILITY, description: "Guest deposits and advances" },

  // ── EQUITY ────────────────────────────────────────────────────
  { code: "3100", name: "Owner Equity",            type: LEDGER_ACCOUNT_TYPE.EQUITY,    description: "Owners capital contribution" },
  { code: "3200", name: "Retained Earnings",       type: LEDGER_ACCOUNT_TYPE.EQUITY,    description: "Accumulated profits" },

  // ── REVENUE ───────────────────────────────────────────────────
  { code: "4100", name: "Room Revenue",            type: LEDGER_ACCOUNT_TYPE.REVENUE,   description: "Revenue from room bookings" },
  { code: "4200", name: "F&B Revenue",             type: LEDGER_ACCOUNT_TYPE.REVENUE,   description: "Food and beverage sales" },
  { code: "4300", name: "Other Revenue",           type: LEDGER_ACCOUNT_TYPE.REVENUE,   description: "Laundry, spa, ancillary services" },

  // ── EXPENSE ───────────────────────────────────────────────────
  { code: "5100", name: "Cost of Goods Sold",      type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Direct cost of inventory consumed" },
  { code: "5110", name: "Food Cost",               type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Cost of food consumed in F&B" },
  { code: "5120", name: "Beverage Cost",           type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Cost of beverages consumed" },
  { code: "5200", name: "Purchase Expense",        type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "General purchase expenditure" },
  { code: "5300", name: "Wastage / Spoilage",      type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Perishable wastage write-off" },
  { code: "5400", name: "Staff Expense",           type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Payroll and staff-related costs" },
  { code: "5500", name: "Utility Expense",         type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Electricity, water, gas" },
  { code: "5600", name: "Marketing Expense",       type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Advertising and promotions" },
  { code: "5700", name: "Admin & General Expense", type: LEDGER_ACCOUNT_TYPE.EXPENSE,   description: "Miscellaneous administrative costs" },
];
