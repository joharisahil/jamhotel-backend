/**
 * @controller vendorController.js
 * @description CRUD for Vendor master records.
 *              Outstanding balance is always derived — never stored.
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import Vendor from "../../models/Vendor.js";
import * as paymentService from "../../services/paymentService.js";
import * as ledgerService from "../../services/ledgerService.js";
import * as auditService from "../../services/auditService.js";

import {
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../../constants/enums.js";

import { MSG } from "../../constants/messages.js";

// ── List ─────────────────────────────────────────────────────────

export const listVendors = asyncHandler(async (req, res) => {
  const { active, search } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (active !== undefined) filter.isActive = active === "true";
  if (search) filter.$text = { $search: search };

  const vendors = await Vendor.find(filter).sort({ name: 1 });

  // Attach derived outstanding
  const enriched = await Promise.all(
    vendors.map(async (v) => {
      const { outstanding } =
        await paymentService.getVendorOutstanding(
          req.user.hotel_id,
          v._id
        );

      return { ...v.toObject(), outstanding };
    })
  );

  res.json({ success: true, data: enriched });
});

// ── Get Single ───────────────────────────────────────────────────

export const getVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!vendor) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
  }

  const outstanding =
    await paymentService.getVendorOutstanding(
      req.user.hotel_id,
      vendor._id
    );

  res.json({
    success: true,
    data: { ...vendor.toObject(), ...outstanding },
  });
});

// ── Create ───────────────────────────────────────────────────────

export const createVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.create({
    hotel_id: req.user.hotel_id,
    ...req.body,
    createdBy: req.user._id,
  });

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.VENDOR,
    entity_id: vendor._id,
    entityReference: vendor.name,
    action: AUDIT_ACTION.CREATED,
    description: `Vendor '${vendor.name}' created`,
    after: vendor.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: vendor });
});

// ── Update ───────────────────────────────────────────────────────

export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!vendor) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
  }

  const before = vendor.toObject();

  const allowedUpdates = [
    "name",
    "contactPerson",
    "email",
    "phone",
    "address",
    "gstRegistered",
    "gstin",
    "panNumber",
    "paymentTerms",
    "creditDays",
    "bankDetails",
    "openingBalance",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      vendor[field] = req.body[field];
    }
  });

  vendor.updatedBy = req.user._id;
  await vendor.save();

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.VENDOR,
    entity_id: vendor._id,
    entityReference: vendor.name,
    action: AUDIT_ACTION.UPDATED,
    description: `Vendor '${vendor.name}' updated`,
    before,
    after: vendor.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: vendor });
});

// ── Toggle Active ────────────────────────────────────────────────

export const toggleVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!vendor) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
  }

  vendor.isActive = !vendor.isActive;
  vendor.updatedBy = req.user._id;
  await vendor.save();

  const action = vendor.isActive
    ? AUDIT_ACTION.ACTIVATED
    : AUDIT_ACTION.DEACTIVATED;

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.VENDOR,
    entity_id: vendor._id,
    entityReference: vendor.name,
    action,
    description: `Vendor '${vendor.name}' ${
      vendor.isActive ? "activated" : "deactivated"
    }`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: vendor });
});

// ── Vendor Ledger ─────────────────────────────────────────────────

export const getVendorLedger = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;

  const result = await ledgerService.getVendorLedger(
    req.user.hotel_id,
    req.params.id,
    fromDate,
    toDate
  );

  res.json({ success: true, data: result });
});
