import dotenv from "dotenv";
// Reload environment configuration
dotenv.config();

import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    app.log.info(`🌲 Groveveil API server running at ${address}`);
  } catch (err) {
    app.log.error(err, "Failed to start Groveveil server");
    process.exit(1);
  }
}

start();
