import { describe, expect, it } from "vitest";
import { resolveReturnUrl } from "../src/return-url.js";
import type { ProductConfig } from "../src/types.js";

const product: ProductConfig = {
  id: "fileguard",
  name: "FileGuard",
  appBaseUrl: "https://fileguard.helixrs.com",
  allowedReturnOrigins: ["https://fileguard.helixrs.com", "http://localhost:5173"],
  entra: {
    clientIdEnv: "FILEGUARD_ENTRA_CLIENT_ID",
    clientSecretEnv: "FILEGUARD_ENTRA_CLIENT_SECRET",
    authorityTenant: "organizations",
    scopes: ["openid", "profile", "email"],
  },
  tenantAllowlist: [],
  roleMap: {},
};

describe("resolveReturnUrl", () => {
  it("defaults to the product base URL", () => {
    expect(resolveReturnUrl(product)).toBe("https://fileguard.helixrs.com");
  });

  it("allows configured origins", () => {
    expect(resolveReturnUrl(product, "http://localhost:5173/auth/callback")).toBe(
      "http://localhost:5173/auth/callback",
    );
  });

  it("supports relative paths under the product base URL", () => {
    expect(resolveReturnUrl(product, "/auth/callback")).toBe(
      "https://fileguard.helixrs.com/auth/callback",
    );
  });

  it("rejects untrusted origins", () => {
    expect(() => resolveReturnUrl(product, "https://evil.example.com/auth/callback")).toThrow(
      "Return URL is not allowed",
    );
  });
});
