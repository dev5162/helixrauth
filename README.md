# Helixrs Auth Gateway

Shared Microsoft Entra ID SSO gateway for FileGuard and future Helixrs products.

The gateway owns the Microsoft OAuth details, validates customer tenant access per
product, maps Entra app roles into product roles, and issues Helixrs-signed JWTs
that downstream apps can verify without talking to Microsoft directly.

## What is implemented

- Microsoft Entra authorization-code login through `@azure/msal-node`
- Separate product configuration for FileGuard, NextApp, and future products
- Tenant allowlist checked by `tenantId + productId` on every login
- Entra app role mapping into gateway roles
- One-time handoff code exchange for downstream apps
- Gateway session JWT signing with RS256 in production, HS256 for local dev
- JWKS endpoint for RS256 public-key verification
- Token verification endpoint for backend integrations
- Admin-consent redirect helper

## Local setup

```bash
npm install
cp .env.example .env
cp config/products.example.json config/products.json
npm run dev
```

The service starts on `http://localhost:8080` by default.

## Required configuration

`PRODUCT_CONFIG_PATH` points to a JSON file describing products, allowed return
origins, Entra app registrations, tenant allowlists, and role maps.

For production, set:

- `SESSION_SIGNING_ALG=RS256`
- `SESSION_PRIVATE_KEY_PEM`
- `SESSION_PUBLIC_KEY_PEM`
- `STATE_SECRET`
- product-specific Entra client ID and secret environment variables

For local development only, `SESSION_SIGNING_ALG=HS256` can be used with
`SESSION_SECRET`.

## Login flow

1. Product sends the user to:

   ```text
   GET /auth/:productId/login?returnUrl=https://product.example.com/auth/callback
   ```

2. Gateway redirects the user to Microsoft.
3. Microsoft redirects back to:

   ```text
   GET /auth/callback?code=...&state=...
   ```

4. Gateway validates the Microsoft result, checks tenant access for the product,
   maps roles, creates a one-time `gateway_code`, and redirects to the product
   return URL.
5. Product backend exchanges the code:

   ```text
   POST /auth/:productId/exchange
   { "code": "..." }
   ```

6. Product verifies the returned JWT locally from `/.well-known/jwks.json`, or
   by calling:

   ```text
   POST /auth/:productId/verify
   Authorization: Bearer <gateway-token>
   ```

## Security notes

- The apps never receive Entra client secrets.
- The apps only trust gateway-issued tokens.
- Tenant approval is product-specific, so a customer can be approved for
  FileGuard and blocked from another product.
- The handoff code is single-use and short-lived.
- Use a shared cache such as Redis for handoff codes when running multiple
  gateway instances.

## Scripts

```bash
npm run dev
npm run build
npm test
npm run typecheck
```
