import express from "express";
import { protect } from "../utils/authMiddleware.js";
import { searchGuests } from "../controllers/v2/guestSearchController.js";
import { throttleGuestSearch } from "../middleware/searchThrottleMiddleware.js";
const router = express.Router();

router.get("/search", protect, throttleGuestSearch, searchGuests);

export default router;
