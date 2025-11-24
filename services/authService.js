import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async ({ name, email, password, role, hotel_id }) => {
  const exists = await User.findOne({ email, hotel_id });
  if (exists) throw new Error("User already exists for this hotel");
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash: hash, role, hotel_id });
  return user;
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  console.log("test", user);
  if (!user) throw new Error("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  const token = jwt.sign({ id: user._id, hotel_id: user.hotel_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  return { user, token };
};
