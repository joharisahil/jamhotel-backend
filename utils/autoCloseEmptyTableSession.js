import TableSession from "../models/TableSession.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";

export const autoCloseEmptySession = async (hotel_id, table_id) => {
  const session = await TableSession.findOne({
    hotel_id,
    table_id,
    status: "ACTIVE",
  });

  if (!session) return;

  const orderCount = await Order.countDocuments({
    tableSession_id: session._id,
  });

  // 🔥 CLOSE EMPTY SESSION
  if (orderCount === 0) {
    await TableSession.findByIdAndUpdate(session._id, {
      status: "CLOSED",
      closedAt: new Date(),
    });

    await Table.findByIdAndUpdate(table_id, {
      status: "AVAILABLE",
      activeSession: null,
    });
  }
};
