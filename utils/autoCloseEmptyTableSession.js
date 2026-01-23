import TableSession from "../models/TableSession.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";

export const autoCloseEmptySession = async (hotel_id, table_id) => {
  const sessions = await TableSession.find({
    hotel_id,
    table_id,
    status: "ACTIVE",
  }).sort({ startedAt: -1 });

  for (const session of sessions) {
    const pending = await Order.countDocuments({
      tableSession_id: session._id,
      paymentStatus: "PENDING",
    });

    if (pending === 0) {
  await TableSession.findByIdAndUpdate(session._id, {
    status: "CLOSED",
    closedAt: new Date(),
  });

  // 🔥 CLEAR TABLE POINTER IF IT MATCHES
  await Table.updateOne(
    {
      _id: table_id,
      "activeSession.sessionId": session._id,
    },
    {
      $set: {
        status: "AVAILABLE",
        activeSession: null,
      },
    }
  );
}
  }

  // Final cleanup
  const stillActive = await TableSession.findOne({
    hotel_id,
    table_id,
    status: "ACTIVE",
  });

  if (!stillActive) {
    await Table.findByIdAndUpdate(table_id, {
      status: "AVAILABLE",
      activeSession: null,
    });
  }
};
