import KOT from "../models/KOT.js";
import Order from "../models/Order.js";
import { emitToHotel } from "../utils/socket.js";

export const updateKotItemStatus = async (kotId, itemIndex, newStatus) => {
  const kot = await KOT.findById(kotId);
  if (!kot) throw new Error("KOT not found");
  kot.items[itemIndex].status = newStatus;
  await kot.save();
  // if all served -> update order status
  const allServed = kot.items.every(i => i.status === "SERVED");
  if (allServed) {
    await Order.findByIdAndUpdate(kot.order_id, { status: "DELIVERED" });
  }
  emitToHotel(kot.hotel_id, "kot:status_update", { kotId, items: kot.items });
  return kot;
};
