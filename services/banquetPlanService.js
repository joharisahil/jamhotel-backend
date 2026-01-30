// services/banquetPlanService.js
import BanquetPlan from "../models/BanquetPlan.js";
import MenuItem from "../models/MenuItem.js";

export const createPlan = async (hotel_id, payload) => {
  for (const item of payload.items || []) {
    if (!item.allowedMenuItems?.length) continue;

    const menuItems = await MenuItem.find({
      _id: { $in: item.allowedMenuItems },
      hotel_id,
    }).select("category_id isVeg");

    if (menuItems.length !== item.allowedMenuItems.length) {
      throw new Error("Invalid menu items detected");
    }

    for (const mi of menuItems) {
      if (String(mi.category_id) !== String(item.category_id)) {
        throw new Error("Menu item category mismatch in plan");
      }
      if (mi.isVeg !== item.isVeg) {
        throw new Error("Veg / Non-Veg mismatch in plan item");
      }
    }
  }

  return BanquetPlan.create({ hotel_id, ...payload });
};

export const listPlans = async (hotel_id) =>
  BanquetPlan.find({ hotel_id })
    .populate("items.category_id")
    .populate("items.allowedMenuItems")
    .sort({ createdAt: -1 });

export const getPlan = async (hotel_id, id) => {
  const plan = await BanquetPlan.findOne({ _id: id, hotel_id })
    .populate("items.category_id")
    .populate("items.allowedMenuItems");

  if (!plan) throw new Error("Plan not found");
  return plan;
};

export const updatePlan = async (hotel_id, id, payload) => {
  const plan = await BanquetPlan.findOneAndUpdate(
    { _id: id, hotel_id },
    payload,
    { new: true }
  );

  if (!plan) throw new Error("Plan not found");
  return plan;
};

export const deletePlan = async (hotel_id, id) => {
  await BanquetPlan.findOneAndUpdate(
    { _id: id, hotel_id },
    { isActive: false }
  );
};
