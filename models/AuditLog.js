/**
 * @model AuditLog
 * @description Immutable audit trail for all financial and inventory actions.
 *              Captures before/after values, performer identity, role, IP, and timestamp.
 *              Records must NEVER be deleted or edited.
 */
import mongoose from "mongoose";
import {
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
  ROLES,
} from "../constants/enums.js";
const auditLogSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: { values: Object.values(AUDIT_ENTITY_TYPE), message: 'Invalid entity type' },
      required: true,
      index: true,
    },
    entity_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entityReference: {
      type: String, // Human-readable: invoice number, SKU, etc.
      trim: true,
      default: '',
    },
    action: {
      type: String,
      enum: { values: Object.values(AUDIT_ACTION), message: 'Invalid audit action' },
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    // Serialised JSON strings of the document state before and after
    beforeValue: {
      type: String,
      default: null,
    },
    afterValue: {
      type: String,
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performerName: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    // createdAt only — no updatedAt
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ── Indexes ─────────────────────────────────────────────────────
auditLogSchema.index({ hotel_id: 1, entityType: 1, entity_id: 1 });
auditLogSchema.index({ hotel_id: 1, performedBy: 1, createdAt: -1 });
auditLogSchema.index({ hotel_id: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ hotel_id: 1, createdAt: -1 });

// ── Guard: immutable records ─────────────────────────────────────
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('AuditLog records are immutable and cannot be modified or deleted.');
});

export default mongoose.model("AuditLog", auditLogSchema);
