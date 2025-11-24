// validators/userValidator.js
import { z } from "zod";

/**
 * Allowed roles for hotel system
 * (Same as your RBAC roles)
 */
export const USER_ROLES = [
  "MD",
  "GM",
  "FRONT_OFFICE",
  "BANQUET_MANAGER",
  "RESTAURANT_MANAGER",
  "KITCHEN_MANAGER",
  "STORE_MANAGER",
  "MAINTENANCE_MANAGER",
  "LAUNDRY_MANAGER",
  "SECURITY"
];

/**
 * Create department user schema
 * This is used for MD/GM creating new staff users
 */
export const createUserSchema = z.object({
  name: z
    .string({
      required_error: "Name is required",
    })
    .min(2, "Name must be at least 2 characters"),

  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format"),

  role: z.enum(USER_ROLES, {
    required_error: "Role is required",
    invalid_type_error: "Invalid role",
  }),

  // MD or GM creation does NOT allow manual password input (auto-generated)
});

/**
 * Update user schema
 * MD/GM may update name or role
 */
export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(USER_ROLES).optional(),
});
