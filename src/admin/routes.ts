import express, { type NextFunction, type Request, type Response } from "express";
import React from "react";
import { renderToString } from "react-dom/server";
import { AdminPage } from "./page.js";
import {
  createProductAction,
  updateProductAction,
  upsertRoleMappingAction,
  upsertTenantAccessAction,
  listAdminProducts,
} from "./index.js";
import fs from "node:fs";
import path from "node:path";
import cookie from "cookie";
import { verifyGatewayToken, createGatewayToken } from "../tokens.js";
import { getProduct } from "../product-store.js";
import { HttpError } from "../http-error.js";
import type { AppConfig } from "../types.js";
import type { HandoffStore } from "../handoff-store.js";
import type { JWTPayload } from "jose";

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAdminPage(
  products: Awaited<ReturnType<typeof listAdminProducts>>,
  databaseConfigured: boolean,
  user?: JWTPayload,
): string {
  const appHtml = renderToString(React.createElement(AdminPage, { products, databaseConfigured }));

  const cssPath = path.resolve(process.cwd(), "src/admin/styles.css");
  const css = fs.readFileSync(cssPath, "utf8");

  const userInfoHtml = user
    ? `
      <div class="sidebar-user" style="padding: 16px 20px; border-top: 1px solid var(--sidebar-hover); display: flex; flex-direction: column; gap: 4px;">
        <div style="color: #fff; font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(String(user.name || "Admin"))}</div>
        <div style="color: var(--sidebar-text); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(String(user.email || ""))}</div>
        <a href="/admin/logout" style="color: var(--danger); text-decoration: none; font-size: 12px; font-weight: 500; margin-top: 4px; display: inline-block;">Logout</a>
      </div>
      `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Helixrs Auth Admin</title>
  <style>${css}</style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="6" fill="currentColor"/>
            <path d="M8 14h4l2-6 4 12 2-6h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="brand-name">Helixrs Auth</div>
          <div class="brand-sub">Admin</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <a href="#" class="nav-link active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Dashboard
        </a>
        <a href="#products" class="nav-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          Products
        </a>
        <a href="#tenants" class="nav-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          Tenants
        </a>
        <a href="#roles" class="nav-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Roles
        </a>
      </nav>
      ${userInfoHtml}
      <div class="sidebar-footer">
        <div class="version">v1.0</div>
      </div>
    </aside>
    <main class="main">
      ${appHtml}
    </main>
  </div>
</body>
</html>`;
}

export function createAdminRouter(config: AppConfig, handoffStore: HandoffStore) {
  const router = express.Router();

  const adminAuthMiddleware = asyncHandler(async (request: Request, response: Response, next: NextFunction) => {
    const cookies = cookie.parse(request.headers.cookie || "");
    const sessionToken = cookies.admin_session;
    if (!sessionToken) {
      throw new HttpError(401, "Unauthorized.", "unauthorized");
    }

    try {
      const product = await getProduct(config, "helixrauthadmin");
      if (!product) {
        throw new Error("Admin product not configured");
      }
      const payload = await verifyGatewayToken(config, product, sessionToken);
      const roles = (payload.roles as string[]) || [];
      if (!roles.includes("Admin")) {
        throw new HttpError(403, "Forbidden.", "forbidden");
      }
      next();
    } catch {
      throw new HttpError(401, "Unauthorized.", "unauthorized");
    }
  });

  router.get(
    "/admin",
    asyncHandler(async (request, response) => {
      // 1. Check for gateway_code from SSO redirect
      const code = request.query.gateway_code?.toString();
      if (code) {
        const product = await getProduct(config, "helixrauthadmin");
        if (!product) {
          return response.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">helixrauthadmin Product Missing</h1>
              <p>The admin portal product (with slug <code>helixrauthadmin</code>) is not registered in the database or config.</p>
              <p>Please seed the database or update your <code>products.json</code> to include this product, then restart the server.</p>
            </div>
          `);
        }

        let identity;
        try {
          identity = handoffStore.consume(code);
        } catch {
          // If code is invalid/expired, redirect to login again
          return response.redirect(`/auth/helixrauthadmin/login?returnUrl=${encodeURIComponent("/admin")}`);
        }

        if (identity.productId !== "helixrauthadmin") {
          throw new HttpError(400, "Gateway code was issued for a different product.", "product_mismatch");
        }

        if (!identity.roles.includes("Admin")) {
          return response.status(403).send(`
            <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">Access Denied</h1>
              <p>You do not have the <code>Admin</code> role mapped for this application.</p>
              <a href="/admin/logout">Try logging in with a different account</a>
            </div>
          `);
        }

        const accessToken = await createGatewayToken(config, product, identity);

        response.cookie("admin_session", accessToken, {
          httpOnly: true,
          secure: config.nodeEnv === "production",
          sameSite: "lax",
          maxAge: config.sessionTtlSeconds * 1000,
        });

        return response.redirect("/admin");
      }

      // 2. Normal check for session cookie
      const cookies = cookie.parse(request.headers.cookie || "");
      const sessionToken = cookies.admin_session;
      if (!sessionToken) {
        return response.redirect(`/auth/helixrauthadmin/login?returnUrl=${encodeURIComponent("/admin")}`);
      }

      let payload;
      try {
        const product = await getProduct(config, "helixrauthadmin");
        if (!product) {
          return response.status(500).send(`
            <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">helixrauthadmin Product Missing</h1>
              <p>The admin portal product (with slug <code>helixrauthadmin</code>) is not registered in the database or config.</p>
              <p>Please seed the database or update your <code>products.json</code> to include this product, then restart the server.</p>
            </div>
          `);
        }
        payload = await verifyGatewayToken(config, product, sessionToken);
      } catch (err) {
        response.clearCookie("admin_session");
        return response.redirect(`/auth/helixrauthadmin/login?returnUrl=${encodeURIComponent("/admin")}`);
      }

      const roles = (payload.roles as string[]) || [];
      if (!roles.includes("Admin")) {
        response.clearCookie("admin_session");
        return response.status(403).send(`
          <div style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">Access Denied</h1>
            <p>You do not have the <code>Admin</code> role mapped for this application.</p>
            <a href="/admin/logout">Try logging in with a different account</a>
          </div>
        `);
      }

      const databaseConfigured = Boolean(process.env.DATABASE_URL);
      const products = await listAdminProducts();
      response.send(renderAdminPage(products, databaseConfigured, payload));
    }),
  );

  router.get(
    "/admin/logout",
    asyncHandler(async (_request, response) => {
      response.clearCookie("admin_session");
      response.redirect("/admin");
    }),
  );

  router.post(
    "/admin/products/create",
    adminAuthMiddleware,
    asyncHandler(async (request, response) => {
      await createProductAction(request.body);
      response.redirect("/admin");
    }),
  );

  router.post(
    "/admin/products/update",
    adminAuthMiddleware,
    asyncHandler(async (request, response) => {
      await updateProductAction(request.body);
      response.redirect("/admin");
    }),
  );

  router.post(
    "/admin/tenants",
    adminAuthMiddleware,
    asyncHandler(async (request, response) => {
      await upsertTenantAccessAction(request.body);
      response.redirect("/admin");
    }),
  );

  router.post(
    "/admin/roles",
    adminAuthMiddleware,
    asyncHandler(async (request, response) => {
      await upsertRoleMappingAction(request.body);
      response.redirect("/admin");
    }),
  );

  return router;
}

export async function closeAdmin(): Promise<void> {
  const { closeAdminPool } = await import("./db.js");
  await closeAdminPool();
}
