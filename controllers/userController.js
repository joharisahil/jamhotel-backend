// controllers/userController.js
import { asyncHandler } from "../utils/asyncHandler.js";
import * as userService from "../services/userService.js";
import User from "../models/User.js";
import { createUserSchema, updateUserSchema } from "../validators/userValidator.js";

/**
 * Create department user (by MD/GM)
 * Auto generate password based on email prefix
 */
export const createDepartmentUser = asyncHandler(async (req, res) => {
  const parsed = createUserSchema.parse(req.body);
  const hotel_id = req.user.hotel_id;

  const { user, rawPassword } = await userService.createDepartmentUser(
    hotel_id,
    parsed
  );

  res.json({
    success: true,
    message: "User created successfully",
    user,
    password: rawPassword,
  });
});

/**
 * List users
 */
export const listUsers = asyncHandler(async (req, res) => {
  const hotel_id = req.user.hotel_id;
  const users = await userService.listUsers(hotel_id);
  res.json({ success: true, users });
});

/**
 * Get single user
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, user });
});

/**
 * Update user details
 */
export const updateUser = asyncHandler(async (req, res) => {
  const parsed = updateUserSchema.parse(req.body);
  const user = await userService.updateUser(req.params.id, parsed);

  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  res.json({ success: true, user });
});

/**
 * Soft delete user (inactive)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.deleteUser(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, message: "User deactivated successfully" });
});
