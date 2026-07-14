import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { buildIdentity, getTenantAccess } from "./access.js";
import { getAdminConsentUrl, getAuthorizationUrl, exchangeCodeForUser } from "./entra.js";
import { HttpError, isHttpError } from "./http-error.js";
import { HandoffStore } from "./handoff-store.js";
import { appendQueryParam, resolveReturnUrl } from "./return-url.js";
import { signAuthState, verifyAuthState } from "./state.js";
import { createGatewayToken, getJwks, verifyGatewayToken } from "./tokens.js";
import { getProduct } from "./product-store.js";
import type { AppConfig, ProductConfig } from "./types.js";

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const exchangeBodySchema = z.object({
  code: z.string().min(1),
});

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

async function productFromRequest(config: AppConfig, request: Request): Promise<ProductConfig> {
  const productId = request.params.productId;
  if (typeof productId !== "string") {
    throw new HttpError(400, "Invalid product ID.", "invalid_product_id");
  }

  const product = await getProduct(config, productId);
  if (!product) {
    throw new HttpError(404, "Unknown product.", "unknown_product");
  }
  return product;
}

function bearerToken(request: Request): string {
  const header = request.header("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, "Missing bearer token.", "missing_bearer_token");
  }
  return match[1];
}

export function createRouter(config: AppConfig, handoffStore = new HandoffStore(config.handoffCodeTtlSeconds)) {
  const router = express.Router();

  router.get("/health", (_request, response) => {
    response.json({ ok: true, env: process.env });
  });

  router.get(
    "/.well-known/jwks.json",
    asyncHandler(async (_request, response) => {
      response.json(await getJwks(config));
    }),
  );

  router.get(
    "/auth/:productId/login",
    asyncHandler(async (request, response) => {
      const product = await productFromRequest(config, request);
      const returnUrl = resolveReturnUrl(product, request.query.returnUrl?.toString());
      const state = await signAuthState(config.stateSecret, {
        productId: product.id,
        returnUrl,
      });
      response.redirect(await getAuthorizationUrl(config, product, state));
    }),
  );

  router.get(
    "/auth/callback",
    asyncHandler(async (request, response) => {
      const code = request.query.code?.toString();
      const stateToken = request.query.state?.toString();
      if (!code || !stateToken) {
        throw new HttpError(400, "Microsoft callback is missing code or state.", "invalid_callback");
      }

      const state = await verifyAuthState(config.stateSecret, stateToken);
      const product = await getProduct(config, state.productId);
      if (!product) {
        throw new HttpError(400, "Auth state references an unknown product.", "unknown_product");
      }

      const entraUser = await exchangeCodeForUser(config, product, code);
      const tenant = getTenantAccess(product, entraUser.tenantId);
      if (!tenant || tenant.status !== "approved") {
        throw new HttpError(403, "Tenant is not approved for this product.", "tenant_not_approved");
      }

      const identity = buildIdentity({
        product,
        tenant,
        tenantId: entraUser.tenantId,
        userId: entraUser.userId,
        email: entraUser.email,
        name: entraUser.name,
        entraRoles: entraUser.roles,
      });

      const handoffCode = handoffStore.create(identity);
      response.redirect(appendQueryParam(state.returnUrl, "gateway_code", handoffCode));
    }),
  );

  router.post(
    "/auth/:productId/exchange",
    asyncHandler(async (request, response) => {
      const product = await productFromRequest(config, request);
      const body = exchangeBodySchema.parse(request.body);
      const identity = handoffStore.consume(body.code);

      if (identity.productId !== product.id) {
        throw new HttpError(400, "Gateway code was issued for a different product.", "product_mismatch");
      }

      const accessToken = await createGatewayToken(config, product, identity);
      response.json({
        tokenType: "Bearer",
        accessToken,
        expiresIn: config.sessionTtlSeconds,
      });
    }),
  );

  router.post(
    "/auth/:productId/verify",
    asyncHandler(async (request, response) => {
      const product = await productFromRequest(config, request);
      const payload = await verifyGatewayToken(config, product, bearerToken(request));
      response.json({
        active: true,
        claims: payload,
      });
    }),
  );

  router.get(
    "/auth/:productId/admin-consent",
    asyncHandler(async (request, response) => {
      const product = await productFromRequest(config, request);
      const returnUrl = resolveReturnUrl(product, request.query.returnUrl?.toString());
      const state = await signAuthState(config.stateSecret, {
        productId: product.id,
        returnUrl,
      });
      response.redirect(getAdminConsentUrl(config, product, state));
    }),
  );

  router.get(
    "/auth/admin-consent/callback",
    asyncHandler(async (request, response) => {
      const stateToken = request.query.state?.toString();
      if (!stateToken) {
        throw new HttpError(400, "Admin consent callback is missing state.", "invalid_callback");
      }

      const state = await verifyAuthState(config.stateSecret, stateToken);
      const redirectUrl = appendQueryParam(
        state.returnUrl,
        "admin_consent",
        request.query.admin_consent?.toString() === "True" ? "granted" : "denied",
      );
      response.redirect(redirectUrl);
    }),
  );

  router.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: "invalid_request",
        message: "Request validation failed.",
        details: error.flatten(),
      });
      return;
    }

    if (isHttpError(error)) {
      response.status(error.status).json({
        error: error.code,
        message: error.message,
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: "internal_server_error",
      message: "Unexpected server error.",
    });
  });

  return router;
}
