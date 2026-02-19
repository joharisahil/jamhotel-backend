/**
 * @controller auditController.js
 * @description Audit trail query endpoints (Read-only).
 */

import { asyncHandler } from "../../utils/asyncHandler.js";
import * as auditService from "../../services/auditService.js";

export const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    entityType,
    entity_id,
    action,
    performedBy,
    fromDate,
    toDate,
    page = 1,
    limit = 50,
  } = req.query;

  // Always scoped to logged-in user's hotel
  const hotel_id = req.user.hotel_id;

  const result = await auditService.getAuditLogs({
    hotel_id,
    entityType,
    entity_id,
    action,
    performedBy,
    fromDate,
    toDate,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({ success: true, ...result });
});
