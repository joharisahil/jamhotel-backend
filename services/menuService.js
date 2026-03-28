import MenuCategory from "../models/MenuCategory.js";
import MenuItem from "../models/MenuItem.js";
import { emitToHotel } from "../utils/socket.js";

/**
 * ------------------------
 * CATEGORY SERVICES
 * ------------------------
 */
export const createCategory = async (hotel_id, payload) => {
  const category = await MenuCategory.create({ hotel_id, ...payload });

  // notify all clients that menu changed
  emitToHotel(hotel_id, "menu:updated", { type: "category_created", category });

  return category;
};

export const listCategories = async (hotel_id) => {
  return MenuCategory.find({ hotel_id }).sort({ _id: 1 });
};

export const updateCategory = async (hotel_id, id, payload) => {
  const category = await MenuCategory.findOneAndUpdate(
    { _id: id, hotel_id },
    payload,
    { new: true }
  );
  emitToHotel(hotel_id, "menu:updated", { type: "category_updated", category });
  return category;
};

export const deleteCategory = async (hotel_id, id) => {
  await MenuCategory.findOneAndDelete({ _id: id, hotel_id });
  await MenuItem.deleteMany({ category_id: id, hotel_id });
  emitToHotel(hotel_id, "menu:updated", { type: "category_deleted", id });
};


/**
 * ------------------------
 * MENU ITEM SERVICES
 * ------------------------
 */
export const createMenuItem = async (hotel_id, payload) => {

  const data = {
    hotel_id,
    category_id: payload.category_id,
    name: payload.name,
    description: payload.description || "",
    isVeg: payload.isVeg ?? true, 
    isActive: payload.isActive ?? true,
    prepTimeMins: payload.prepTimeMins || 0,
    imageUrl: payload.imageUrl || "",
  };

  // ---- PRICE MAPPING (IMPORTANT) ----
  if (payload.price !== undefined) {
    data.priceSingle = Number(payload.price);
  }

  if (payload.priceHalf !== undefined) {
    data.priceHalf = Number(payload.priceHalf);
  }

  if (payload.priceFull !== undefined) {
    data.priceFull = Number(payload.priceFull);
  }

  // Save
  const item = await MenuItem.create(data);

  emitToHotel(hotel_id, "menu:updated", {
    type: "item_created",
    item,
  });

  return item;
};


export const listMenuItems = async (hotel_id, category_id) => {
  const q = { hotel_id };
  if (category_id) q.category_id = category_id;
  return MenuItem.find(q).sort({ _id: 1 });
};

export const updateMenuItem = async (hotel_id, id, payload) => {
  const setData = {};
  const unsetData = {};

  // ✅ Normal fields
  if (payload.name !== undefined) setData.name = payload.name;
  if (payload.description !== undefined) setData.description = payload.description;
  if (payload.category_id !== undefined) setData.category_id = payload.category_id;
  if (payload.isVeg !== undefined) setData.isVeg = payload.isVeg;
  if (payload.isActive !== undefined) setData.isActive = payload.isActive;

  // ✅ PRICE LOGIC (MAIN FIX)

  if (payload.priceSingle !== undefined) {
    setData.priceSingle = payload.priceSingle;

    // ❗ remove others
    unsetData.priceHalf = "";
    unsetData.priceFull = "";
  }

  if (payload.priceHalf !== undefined) {
    setData.priceHalf = payload.priceHalf;

    // ❗ remove single ONLY (not full)
    unsetData.priceSingle = "";
  }

  if (payload.priceFull !== undefined) {
    setData.priceFull = payload.priceFull;

    // ❗ remove single ONLY (not half)
    unsetData.priceSingle = "";
  }

  const updateQuery = {
    ...(Object.keys(setData).length && { $set: setData }),
    ...(Object.keys(unsetData).length && { $unset: unsetData }),
  };

  const item = await MenuItem.findOneAndUpdate(
    { _id: id, hotel_id },
    updateQuery,
    { new: true }
  );

  emitToHotel(hotel_id, "menu:updated", { type: "item_updated", item });

  return item;
};

export const deleteMenuItem = async (hotel_id, id) => {
  await MenuItem.findOneAndDelete({ _id: id, hotel_id });
  emitToHotel(hotel_id, "menu:updated", { type: "item_deleted", id });
};

/**
 * ------------------------
 * PUBLIC MENU FOR QR
 * ------------------------
 */
export const getFullMenu = async (hotel_id) => {
  const categories = await listCategories(hotel_id);
  const items = await MenuItem.find({ hotel_id, isActive: true });

  return { categories, items };
};
