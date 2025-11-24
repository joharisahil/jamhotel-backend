// routes/userRoutes.js
import express from "express";
import {
  createDepartmentUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser
} from "../controllers/userController.js";
import { protect, authorize } from "../utils/authMiddleware.js";

const router = express.Router();

// All user management is for MD, GM
router.use(protect);
router.use(authorize("GM", "MD"));

router.post("/", createDepartmentUser);     // create department user
router.get("/", listUsers);                 // list all hotel users
router.get("/:id", getUser);                // get single user
router.put("/:id", updateUser);             // update user name/role
router.delete("/:id", deleteUser);          // deactivate user

export default router;
