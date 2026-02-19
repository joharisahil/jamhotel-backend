/**
 * @service auditService.js
 * @description Centralised audit logging. Called from all controllers and services
 *              after any state-changing operation. Logs are immutable.
 */

import AuditLog from "../models/AuditLog.js";

/**
 * Creates an audit log entry.
 * Failures are caught and logged to stderr — they must never crash the main flow.
 */
export async function log({
  hotel_id,
  entityType,
  entity_id,
  entityReference = "",
  action,
  description,
  before = null,
  after = null,
  user,
  ipAddress = "",
  userAgent = "",
  session = null,
}) {
  try {
    const entry = {
      hotel_id,
      entityType,
      entity_id,
      entityReference,
      action,
      description,
      beforeValue: before ? JSON.stringify(before) : null,
      afterValue: after ? JSON.stringify(after) : null,
      performedBy: user._id,
      performerName: user.name || "",
      role: user.role,
      ipAddress,
      userAgent,
    };

    const options = session ? { session } : {};
    await AuditLog.create([entry], options);
  } catch (err) {
    // Audit logging must never break the main transaction
    console.error(
      "[AuditService] Failed to write audit log:",
      err.message
    );
  }
}

/**
 * Retrieves paginated audit logs for a hotel with optional filters.
 */
export async function getAuditLogs({
  hotel_id,
  entityType,
  entity_id,
  action,
  performedBy,
  fromDate,
  toDate,
  page = 1,
  limit = 50,
}) {
  const filter = { hotel_id };

  if (entityType) filter.entityType = entityType;
  if (entity_id) filter.entity_id = entity_id;
  if (action) filter.action = action;
  if (performedBy) filter.performedBy = performedBy;

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;

  const total = await AuditLog.countDocuments(filter);

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("performedBy", "name email role");

  return {
    logs,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}
