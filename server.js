import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { initSockets } from "./utils/socket.js";
import routes from "./routes/index.js";
import { errorHandler } from "./utils/errorHandler.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1", routes);

app.use(errorHandler);

const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI_PRODUCTION;

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> {
    server.listen(PORT, ()=> console.log(`Server running on ${PORT}`));
  })
  .catch(err => {
    console.error("Mongo connect failed:", err);
  });
