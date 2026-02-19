/**
 * @controller categoryController.js
 * @description CRUD for InventoryCategory (scoped to hotel_id from JWT)
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import InventoryCategory from "../../models/InventoryCategory.js";
import * as auditService from "../../services/auditService.js";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.js";

// ── List ─────────────────────────────────────────────
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await InventoryCategory.find({
    hotel_id: req.user.hotel_id,
    isActive: true,
  })
    .populate("items")
    .sort({ name: 1 });

  res.json({ success: true, data: categories });
});

// ── Create ───────────────────────────────────────────
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const category = await InventoryCategory.create({
    hotel_id: req.user.hotel_id,
    name,
    description: description || "",
    createdBy: req.user._id,
  });

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
    entity_id: category._id,
    entityReference: name,
    action: AUDIT_ACTION.CREATED,
    description: `Category '${name}' created`,
    after: category.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: category });
});

// ── Update ───────────────────────────────────────────
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!category)
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Category") });

  const before = category.toObject();
  const { name, description } = req.body;

  if (name) category.name = name;
  if (description !== undefined) category.description = description;

  await category.save();

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
    entity_id: category._id,
    entityReference: category.name,
    action: AUDIT_ACTION.UPDATED,
    description: `Category '${category.name}' updated`,
    before,
    after: category.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: category });
});

// ── Toggle Active ────────────────────────────────────
export const toggleCategory = asyncHandler(async (req, res) => {
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!category)
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Category") });

  category.isActive = !category.isActive;
  await category.save();

  const action = category.isActive
    ? AUDIT_ACTION.ACTIVATED
    : AUDIT_ACTION.DEACTIVATED;

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
    entity_id: category._id,
    entityReference: category.name,
    action,
    description: `Category '${category.name}' ${
      category.isActive ? "activated" : "deactivated"
    }`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: category });
});
