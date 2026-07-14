import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "./types.js";

const ALLOWED_METHODS = "GET,POST,OPTIONS";
const ALLOWED_HEADERS = "Content-Type,Authorization";

export function createCorsMiddleware(config: Pick<AppConfig, "corsAllowedOrigins">) {
  const allowedOrigins = new Set(config.corsAllowedOrigins);
  const allowAll = allowedOrigins.has("*");

  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header("origin");
    if (!origin) {
      next();
      return;
    }

    if (allowAll || allowedOrigins.has(origin)) {
      response.header("Access-Control-Allow-Origin", allowAll ? "*" : origin);
      response.header("Vary", "Origin");
      response.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
      response.header("Access-Control-Allow-Headers", ALLOWED_HEADERS);

      if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
      }
    }

    next();
  };
}
