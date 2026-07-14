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

For local browser testing, `CORS_ALLOWED_ORIGINS=http://localhost:5173`
allows the FileGuard dev frontend to call the gateway exchange endpoint
directly. Leave this empty in production unless browser-to-gateway calls are
intentional.

## Required configuration

`PRODUCT_CONFIG_PATH` points to a JSON file describing products, allowed return
origins, Entra app registrations, tenant allowlists, and role maps. This is the
local fallback.

For production, set `DATABASE_URL` and run the migrations. When `DATABASE_URL`
is set, the gateway reads product config, redirect origins, tenant access, and
role mappings from SQL Server instead of relying on `products.json`.

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

   For local development only, the FileGuard frontend may call the gateway
   directly when its origin is listed in `CORS_ALLOWED_ORIGINS`:

   ```text
   POST http://localhost:8080/auth/fileguard/exchange
   { "code": "..." }
   ```

6. Product verifies the returned JWT locally from `/.well-known/jwks.json`, or
   by calling:

   ```text
   POST /auth/:productId/verify
   Authorization: Bearer <gateway-token>
   ```

The gateway does not expose `GET /api/auth/me`. That endpoint belongs in the
FileGuard backend, which owns the browser session.

## Database-backed config

Run migrations against SQL Server:

```bash
DATABASE_URL="Server=4.234.176.215,3389;Database=<database>;User Id=HXR8-DEV-SQL;Password=<password>;Encrypt=True;TrustServerCertificate=True" npm run db:migrate
```

Seed the database from `config/products.json`:

```bash
DATABASE_URL="Server=4.234.176.215,3389;Database=<database>;User Id=HXR8-DEV-SQL;Password=<password>;Encrypt=True;TrustServerCertificate=True" DEFAULT_AUTHORITY_TENANT_ID=<tenant-guid> npm run db:seed-products
```

The first migration creates:

- `Products`
- `ProductRedirectOrigins`
- `ProductEntraConfigs`
- `ProductRoleMappings`
- `TenantPRoductAccess`
- `AuditLogs`

The DB field `ClientSecretRef` can store an environment variable name such as
`FILEGUARD_ENTRA_CLIENT_SECRET`, `env:FILEGUARD_ENTRA_CLIENT_SECRET`, or a future
Key Vault reference.

## Admin app

The admin UI is now server-side rendered with React and served by the main
Express gateway. It is mounted automatically when `DATABASE_URL` is set.

```bash
DATABASE_URL="Server=4.234.176.215,3389;Database=<database>;User Id=HXR8-DEV-SQL;Password=<password>;Encrypt=True;TrustServerCertificate=True" npm run dev
```

It runs at `http://localhost:8080/admin` and can list, create, and update product
records. Tenant and role management tables are available on each product edit
card.

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
npm run db:migrate
npm run db:seed-products
npm run build
npm test
npm run typecheck
```
