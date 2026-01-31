import RoomInvoice from "../../models/RoomInvoice.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const searchGuests = asyncHandler( async (req, res) => {
  try {
    console.log("🔥 searchGuests controller hit");

    const hotel_id = req.user?.hotel_id;
    if (!hotel_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { q = "", type = "name", limit = 5 } = req.query;

    if (!q) return res.json({ success: true, data: [] });

    if (type === "name" && q.length < 2)
      return res.json({ success: true, data: [] });

    if (type === "phone" && q.length < 3)
      return res.json({ success: true, data: [] });

    const match = { hotel_id };

    if (type === "name") {
      match.guestName = { $regex: q, $options: "i" };
    } else if (type === "phone") {
      match.guestPhone = { $regex: "^" + q };
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid search type",
      });
    }

    const guests = await RoomInvoice.aggregate([
      { $match: match },

      // ✅ VERY IMPORTANT: latest invoice first
      { $sort: { createdAt: -1 } },

      {
        $group: {
          _id: {
            guestName: "$guestName",
            guestPhone: "$guestPhone",
          },

          // Guest fields
          guestCity: { $first: "$guestCity" },
          guestNationality: { $first: "$guestNationality" },
          guestAddress: { $first: "$guestAddress" },
          adults: { $first: "$adults" },
          children: { $first: "$children" },

          // ✅ Company fields (THIS WAS MISSING)
          companyName: { $first: "$companyName" },
          companyGSTIN: { $first: "$companyGSTIN" },
          companyAddress: { $first: "$companyAddress" },
          guestIds: { $first: "$guestIds" },

          lastStay: { $first: "$createdAt" },
        },
      },

      {
        $project: {
          _id: 0,
          guestName: "$_id.guestName",
          guestPhone: "$_id.guestPhone",
          guestCity: 1,
          guestNationality: 1,
          guestAddress: 1,
          adults: 1,
          children: 1,

          // ✅ Project company fields
          companyName: 1,
          companyGSTIN: 1,
          companyAddress: 1,

          // ✅ expose ID proofs
          guestIds: 1,
        },
      },

      { $limit: Number(limit) },
    ]);

    return res.json({
      success: true,
      data: guests,
    });
  } catch (err) {
    console.error("Guest search error:", err);
    return res.status(500).json({
      success: false,
      message: "Guest search failed",
    });
  }
});

// export const searchGuests = async (req, res) => {
//      console.log("🔥 searchGuests controller hit");
//   const hotel_id = req.user.hotel_id;
//   const { q = "", type = "name", limit = 5 } = req.query;

//   if (!q) {
//     return res.json({ success: true, data: [] });
//   }

//   // Validation
//   if (type === "name" && q.length < 2) {
//     return res.json({ success: true, data: [] });
//   }

//   if (type === "phone" && q.length < 3) {
//     return res.json({ success: true, data: [] });
//   }

//   let match = { hotel_id };

//   if (type === "name") {
//     match.guestName = { $regex: q, $options: "i" };
//   } else if (type === "phone") {
//     match.guestPhone = { $regex: "^" + q };
//   } else {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid search type",
//     });
//   }

//   /**
//    * Use aggregation to get DISTINCT guests
//    */
//   const guests = await RoomInvoice.aggregate([
//     { $match: match },
//     {
//       $group: {
//         _id: {
//           guestName: "$guestName",
//           guestPhone: "$guestPhone",
//         },
//         guestCity: { $first: "$guestCity" },
//         guestNationality: { $first: "$guestNationality" },
//         guestAddress: { $first: "$guestAddress" },
//         adults: { $first: "$adults" },
//         children: { $first: "$children" },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         guestName: "$_id.guestName",
//         guestPhone: "$_id.guestPhone",
//         guestCity: 1,
//         guestNationality: 1,
//         guestAddress: 1,
//         adults: 1,
//         children: 1,
//       },
//     },
//     { $limit: Number(limit) },
//   ]);

//   res.json({
//     success: true,
//     data: guests,
//   });
// };
