import { describe, expect, it } from "vitest";
import { getTenantAccess, isTenantApproved, mapRoles } from "../src/access.js";
import type { ProductConfig } from "../src/types.js";

const product: ProductConfig = {
  id: "fileguard",
  name: "FileGuard",
  appBaseUrl: "https://fileguard.helixrs.com",
  allowedReturnOrigins: ["https://fileguard.helixrs.com"],
  entra: {
    clientIdEnv: "FILEGUARD_ENTRA_CLIENT_ID",
    clientSecretEnv: "FILEGUARD_ENTRA_CLIENT_SECRET",
    authorityTenant: "organizations",
    scopes: ["openid", "profile", "email"],
  },
  tenantAllowlist: [
    { tenantId: "GSK-TENANT", name: "GSK", status: "approved" },
    { tenantId: "NEXT-TENANT", name: "Next customer", status: "not_subscribed" },
  ],
  roleMap: {
    Admin: "admin",
    Editor: "editor",
    Viewer: "viewer",
  },
};

describe("tenant access", () => {
  it("looks up tenants case-insensitively", () => {
    expect(getTenantAccess(product, "gsk-tenant")?.name).toBe("GSK");
  });

  it("only approves explicit approved tenants", () => {
    expect(isTenantApproved(product, "GSK-TENANT")).toBe(true);
    expect(isTenantApproved(product, "NEXT-TENANT")).toBe(false);
    expect(isTenantApproved(product, "UNKNOWN")).toBe(false);
  });
});

describe("role mapping", () => {
  it("maps Entra app roles into product roles", () => {
    expect(mapRoles(product, ["Viewer", "Admin", "Admin"])).toEqual(["admin", "viewer"]);
  });
});
