import { ConfidentialClientApplication, type AuthorizationUrlRequest } from "@azure/msal-node";
import { HttpError } from "./http-error.js";
import type { AppConfig, ProductConfig } from "./types.js";

export interface EntraUser {
  tenantId: string;
  userId: string;
  email?: string;
  name?: string;
  roles: string[];
}

function redirectUri(config: AppConfig): string {
  return new URL("/auth/callback", config.publicBaseUrl).toString();
}

function clientFor(product: ProductConfig): ConfidentialClientApplication {
  const clientId = process.env[product.entra.clientIdEnv];
  const clientSecret = process.env[product.entra.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new HttpError(
      500,
      `Missing Entra credentials for product ${product.id}.`,
      "missing_entra_credentials",
    );
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${product.entra.authorityTenant}`,
    },
  });
}

export async function getAuthorizationUrl(
  config: AppConfig,
  product: ProductConfig,
  state: string,
): Promise<string> {
  const request: AuthorizationUrlRequest = {
    redirectUri: redirectUri(config),
    scopes: product.entra.scopes,
    state,
    prompt: "select_account",
  };

  return clientFor(product).getAuthCodeUrl(request);
}

export async function exchangeCodeForUser(
  config: AppConfig,
  product: ProductConfig,
  code: string,
): Promise<EntraUser> {
  const result = await clientFor(product).acquireTokenByCode({
    code,
    redirectUri: redirectUri(config),
    scopes: product.entra.scopes,
  });

  const claims = result?.idTokenClaims as Record<string, unknown> | undefined;
  if (!claims) {
    throw new HttpError(401, "Microsoft did not return identity claims.", "missing_identity_claims");
  }

  const tenantId = claims.tid;
  const userId = claims.oid ?? claims.sub;
  if (typeof tenantId !== "string" || typeof userId !== "string") {
    throw new HttpError(401, "Microsoft identity claims are missing tenant or user IDs.", "invalid_identity_claims");
  }

  return {
    tenantId,
    userId,
    email: stringClaim(claims.preferred_username) ?? stringClaim(claims.email) ?? stringClaim(claims.upn),
    name: stringClaim(claims.name),
    roles: arrayClaim(claims.roles),
  };
}

export function getAdminConsentUrl(config: AppConfig, product: ProductConfig, state: string): string {
  const clientId = process.env[product.entra.clientIdEnv];
  if (!clientId) {
    throw new HttpError(500, `Missing Entra client ID for product ${product.id}.`, "missing_entra_client_id");
  }

  const url = new URL(`https://login.microsoftonline.com/${product.entra.authorityTenant}/v2.0/adminconsent`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", new URL("/auth/admin-consent/callback", config.publicBaseUrl).toString());
  url.searchParams.set("state", state);
  return url.toString();
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayClaim(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
