import mongoose from "mongoose";
import dotenv from "dotenv";
import { seedLedgerAccountsForHotel } from "../services/ledgerService.js";

dotenv.config();

const MONGO = process.env.MONGO_URI_PRODUCTION; // use same as server

const HOTEL_ID = "692c0ec102fbff740dd06aed";
const ADMIN_USER_ID = "692c0fce02fbff740dd06af0";

const run = async () => {
  try {
    await mongoose.connect(MONGO);
    console.log("Mongo connected ✅");

    await seedLedgerAccountsForHotel(HOTEL_ID, ADMIN_USER_ID);

    console.log("Ledger accounts seeded successfully ✅");
    process.exit();
  } catch (err) {
    console.error("Seeding failed ❌", err);
    process.exit(1);
  }
};

run();