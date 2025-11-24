import { asyncHandler } from "../utils/asyncHandler.js";
import * as authService from "../services/authService.js";
import { loginSchema, registerSchema } from "../validators/authValidator.js";

export const register = asyncHandler(async (req,res) => {
  const parsed = registerSchema.parse(req.body);
  const user = await authService.registerUser(parsed);
  res.json({ success: true, user });
});

export const login = asyncHandler(async (req,res) => {
  const parsed = loginSchema.parse(req.body);
  const { user, token } = await authService.loginUser(parsed);
  res.json({ success: true, user, token });
});
