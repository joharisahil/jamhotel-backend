import { asyncHandler } from "../utils/asyncHandler.js";
import * as kotService from "../services/kotService.js";

export const updateKotItem = asyncHandler(async (req,res) => {
  const { kotId, itemIndex } = req.params;
  const { status } = req.body;
  const kot = await kotService.updateKotItemStatus(kotId, Number(itemIndex), status);
  res.json({ success:true, kot });
});
