import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { createRouter } from "./routes.js";
import type { AppConfig } from "./types.js";

export function createServer(config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));

  if (config.nodeEnv !== "test") {
    app.use(morgan("combined"));
  }

  app.use(createRouter(config));
  return app;
}
