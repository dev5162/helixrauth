import { createSecretKey } from "node:crypto";
import {
  exportJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
  type JWTPayload,
  SignJWT,
} from "jose";
import { HttpError } from "./http-error.js";
import type { AppConfig, GatewayIdentity, ProductConfig } from "./types.js";

function audience(product: ProductConfig): string {
  return `helixrs:${product.id}`;
}

async function signingKey(config: AppConfig) {
  if (config.sessionSigning.alg === "RS256") {
    return importPKCS8(config.sessionSigning.privateKeyPem, "RS256");
  }
  return createSecretKey(Buffer.from(config.sessionSigning.secret, "utf8"));
}

async function verificationKey(config: AppConfig) {
  if (config.sessionSigning.alg === "RS256") {
    return importSPKI(config.sessionSigning.publicKeyPem, "RS256");
  }
  return createSecretKey(Buffer.from(config.sessionSigning.secret, "utf8"));
}

export async function createGatewayToken(
  config: AppConfig,
  product: ProductConfig,
  identity: GatewayIdentity,
): Promise<string> {
  const key = await signingKey(config);
  return new SignJWT({
    product_id: identity.productId,
    tenant_id: identity.tenantId,
    tenant_name: identity.tenantName,
    user_id: identity.userId,
    email: identity.email,
    name: identity.name,
    roles: identity.roles,
  })
    .setProtectedHeader({ alg: config.sessionSigning.alg, typ: "JWT", kid: "helixrs-auth-gateway-current" })
    .setIssuer(config.sessionIssuer)
    .setAudience(audience(product))
    .setSubject(`${identity.tenantId}:${identity.userId}`)
    .setIssuedAt()
    .setExpirationTime(`${config.sessionTtlSeconds}s`)
    .sign(key);
}

export async function verifyGatewayToken(
  config: AppConfig,
  product: ProductConfig,
  token: string,
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, await verificationKey(config), {
      issuer: config.sessionIssuer,
      audience: audience(product),
      algorithms: [config.sessionSigning.alg],
    });
    return payload;
  } catch {
    throw new HttpError(401, "Invalid gateway token.", "invalid_gateway_token");
  }
}

export async function getJwks(config: AppConfig): Promise<{ keys: unknown[] }> {
  if (config.sessionSigning.alg !== "RS256") {
    throw new HttpError(404, "JWKS is only available for RS256 signing.", "jwks_unavailable");
  }

  const publicKey = await importSPKI(config.sessionSigning.publicKeyPem, "RS256");
  const jwk = await exportJWK(publicKey);
  return {
    keys: [
      {
        ...jwk,
        alg: "RS256",
        use: "sig",
        kid: "helixrs-auth-gateway-current",
      },
    ],
  };
}
