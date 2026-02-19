/**
 * @model InventoryItem
 * @description Master inventory item definition. Stock quantity is NEVER stored here —
 *              it is always derived from StockTransaction aggregation.
 *              Direct stock field manipulation is strictly prohibited.
 */

import mongoose from 'mongoose';
import { UNIT_TYPES } from '../constants/enums.js';

const inventoryItemSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'hotel_id is required'],
      index: true,
    },

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: [true, 'Category is required'],
    },

    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'SKU cannot exceed 50 characters'],
    },

    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [200, 'Item name cannot exceed 200 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },

    unit: {
      type: String,
      required: [true, 'Unit of measurement is required'],
      enum: { values: UNIT_TYPES, message: 'Invalid unit type' },
    },

    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price cannot be negative'],
    },

    sellingPrice: {
      type: Number,
      min: [0, 'Selling price cannot be negative'],
      default: 0,
    },

    minimumStock: {
      type: Number,
      default: 0,
      min: [0, 'Minimum stock cannot be negative'],
    },

    isPerishable: {
      type: Boolean,
      default: false,
    },

    shelfLifeDays: {
      type: Number,
      min: [1, 'Shelf life must be at least 1 day'],
      default: null,
      // Required when isPerishable is true — validated in service layer
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────

// SKU must be unique within a hotel
inventoryItemSchema.index({ hotel_id: 1, sku: 1 }, { unique: true });

// Search by name within hotel
inventoryItemSchema.index({ hotel_id: 1, name: 'text' });

// Filter active items by category
inventoryItemSchema.index({ hotel_id: 1, category_id: 1, isActive: 1 });

// ── Pre-save validation ─────────────────────────────────

inventoryItemSchema.pre('save', function (next) {
  if (this.isPerishable && !this.shelfLifeDays) {
    return next(new Error('shelfLifeDays is required for perishable items.'));
  }
  next();
});

export default mongoose.model('InventoryItem', inventoryItemSchema);
