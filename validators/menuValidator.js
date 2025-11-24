import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  order: z.number().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().optional(),
  order: z.number().optional(),
});

export const createMenuItemSchema = z.object({
  category_id: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),

  priceHalf: z.number().optional(),
  priceFull: z.number().min(1, "Price (full) is required"),

  isActive: z.boolean().optional(),
  imageUrl: z.string().optional(),
  gstPercent: z.number().optional(),
  prepTimeMins: z.number().optional(),
});

export const updateMenuItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),

  priceHalf: z.number().optional(),
  priceFull: z.number().optional(),

  isActive: z.boolean().optional(),
  imageUrl: z.string().optional(),
  gstPercent: z.number().optional(),
  prepTimeMins: z.number().optional(),
});
