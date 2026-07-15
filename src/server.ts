import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { createCorsMiddleware } from "./cors.js";
import { createRouter } from "./routes.js";
import { createAdminRouter, closeAdmin } from "./admin/routes.js";
import { HandoffStore } from "./handoff-store.js";
import type { AppConfig } from "./types.js";

export function createServer(config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(createCorsMiddleware(config));
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: true }));

  if (config.nodeEnv !== "test") {
    app.use(morgan("combined"));
  }

  const handoffStore = new HandoffStore(config.handoffCodeTtlSeconds);
  app.use(createRouter(config, handoffStore));

  if (config.databaseUrl) {
    app.use(createAdminRouter(config, handoffStore));
  }

  return app;
}

export async function shutdownServer() {
  await closeAdmin();
}
