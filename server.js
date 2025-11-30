import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";

import { initSockets } from "./utils/socket.js";
import routes from "./routes/index.js";
import { errorHandler } from "./utils/errorHandler.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1", routes);

// Health route (important for keep-alive)
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    message: "✅ Server is alive",
    time: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

// Create server (for sockets)
const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI_PRODUCTION;

/* ----------------------------------------------------
      ⭐ KEEP ALIVE FUNCTION (Render Sleep Prevention)
---------------------------------------------------- */
const BASE_URL =
  process.env.BASE_URL ||
  "https://jamhotel-backend.onrender.com"; // Change if needed

const keepServerAlive = () => {
  const HEALTH_URL = `${BASE_URL}/api/v1/health`;

  const ping = async () => {
    try {
      const res = await axios.get(HEALTH_URL);
      console.log(
        `[KeepAlive] ✅ Ping success: ${res.data.message} @ ${new Date().toISOString()}`
      );
    } catch (err) {
      console.error(
        `[KeepAlive] ❌ Ping failed: ${err.response?.status || err.message}`
      );
    }
  };

  // Delay first ping so server is fully started
  setTimeout(() => {
    ping();
    setInterval(ping, 5 * 60 * 1000); // Every 5 minutes
  }, 10 * 1000);
};

/* ----------------------------------------------------
      ⭐ MONGO CONNECTION + START SERVER
---------------------------------------------------- */
mongoose
  .connect(MONGO)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      keepServerAlive(); // Start keep-alive pings
    });
  })
  .catch((err) => {
    console.error("Mongo connect failed:", err);
  });
