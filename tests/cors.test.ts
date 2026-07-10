import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createServer } from "../src/server.js";
import type { AppConfig } from "../src/types.js";

const config: AppConfig = {
  nodeEnv: "test",
  port: 0,
  publicBaseUrl: "http://localhost:8080",
  corsAllowedOrigins: ["http://localhost:5173"],
  sessionIssuer: "https://auth.helixrs.com",
  sessionTtlSeconds: 28800,
  handoffCodeTtlSeconds: 120,
  stateSecret: "test-state-secret-test-state-secret",
  sessionSigning: {
    alg: "HS256",
    secret: "test-session-secret-test-session-secret",
  },
  products: [
    {
      id: "fileguard",
      name: "FileGuard",
      appBaseUrl: "http://localhost:5173",
      allowedReturnOrigins: ["http://localhost:5173"],
      entra: {
        clientIdEnv: "FILEGUARD_ENTRA_CLIENT_ID",
        clientSecretEnv: "FILEGUARD_ENTRA_CLIENT_SECRET",
        authorityTenant: "organizations",
        scopes: ["openid", "profile", "email"],
      },
      tenantAllowlist: [],
      roleMap: {},
    },
  ],
};

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

async function requestGateway(path: string, init: RequestInit): Promise<Response> {
  const app = createServer(config);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not bind to a local port.");
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

describe("CORS preflight", () => {
  it("allows configured local frontend origins", async () => {
    const response = await requestGateway("/auth/fileguard/exchange", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,POST,OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type,Authorization");
  });

  it("does not allow unconfigured origins", async () => {
    const response = await requestGateway("/auth/fileguard/exchange", {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
