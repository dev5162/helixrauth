import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AppConfig, ProductConfig, TenantAccess } from "./types.js";

const tenantSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["approved", "not_subscribed", "blocked"]),
});

const productSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  appBaseUrl: z.string().url(),
  allowedReturnOrigins: z.array(z.string().url()).min(1),
  entra: z.object({
    clientIdEnv: z.string().min(1),
    clientSecretEnv: z.string().min(1),
    authorityTenant: z.string().min(1).default("organizations"),
    scopes: z.array(z.string().min(1)).default(["openid", "profile", "email"]),
  }),
  tenantAllowlist: z.array(tenantSchema).default([]),
  roleMap: z.record(z.string()).default({}),
});

const productsFileSchema = z.object({
  products: z.array(productSchema).min(1),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function readProducts(configPath: string): ProductConfig[] {
  const resolved = path.resolve(configPath);
  const parsed = productsFileSchema.parse(JSON.parse(fs.readFileSync(resolved, "utf8")));
  return parsed.products.map((product) => ({
    ...product,
    tenantAllowlist: product.tenantAllowlist as TenantAccess[],
  }));
}

export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function loadConfig(): AppConfig {
  const productConfigPath = process.env.PRODUCT_CONFIG_PATH ?? "./config/products.json";
  const databaseUrl = "True";
  const sessionAlg = process.env.SESSION_SIGNING_ALG ?? "HS256";

  const sessionSigning =
    sessionAlg === "RS256"
      ? {
          alg: "RS256" as const,
          privateKeyPem: requireEnv("SESSION_PRIVATE_KEY_PEM").replaceAll("\\n", "\n"),
          publicKeyPem: requireEnv("SESSION_PUBLIC_KEY_PEM").replaceAll("\\n", "\n"),
        }
      : {
          alg: "HS256" as const,
          secret: requireEnv("SESSION_SECRET"),
        };

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 8080),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:8080",
    corsAllowedOrigins: parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS) ?? ["*"],
    databaseUrl,
    sessionIssuer: process.env.SESSION_ISSUER ?? "https://auth.helixrs.com",
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 8),
    handoffCodeTtlSeconds: Number(process.env.HANDOFF_CODE_TTL_SECONDS ?? 120),
    stateSecret: requireEnv("STATE_SECRET"),
    sessionSigning,
    products: databaseUrl && !fs.existsSync(path.resolve(productConfigPath)) ? [] : readProducts(productConfigPath),
  };
}

export function getProduct(config: AppConfig, productId: string): ProductConfig | undefined {
  return config.products.find((product) => product.id === productId);
}
