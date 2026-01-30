import { asyncHandler } from "../utils/asyncHandler.js";
import * as planService from "../services/banquetPlanService.js";

export const createPlan = asyncHandler(async (req, res) => {
  const plan = await planService.createPlan(
    req.user.hotel_id,
    req.body
  );
  res.status(201).json({ success: true, plan });
});

export const listPlans = asyncHandler(async (req, res) => {
  const plans = await planService.listPlans(req.user.hotel_id);
  res.json({ success: true, plans });
});

export const getPlan = asyncHandler(async (req, res) => {
  const plan = await planService.getPlan(
    req.user.hotel_id,
    req.params.id
  );
  res.json({ success: true, plan });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await planService.updatePlan(
    req.user.hotel_id,
    req.params.id,
    req.body
  );
  res.json({ success: true, plan });
});

export const deletePlan = asyncHandler(async (req, res) => {
  await planService.deletePlan(
    req.user.hotel_id,
    req.params.id
  );
  res.json({ success: true, message: "Plan deleted" });
});
