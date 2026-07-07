import type { GatewayIdentity, ProductConfig, TenantAccess } from "./types.js";

export function getTenantAccess(product: ProductConfig, tenantId: string): TenantAccess | undefined {
  return product.tenantAllowlist.find(
    (tenant) => tenant.tenantId.toLowerCase() === tenantId.toLowerCase(),
  );
}

export function isTenantApproved(product: ProductConfig, tenantId: string): boolean {
  return getTenantAccess(product, tenantId)?.status === "approved";
}

export function mapRoles(product: ProductConfig, entraRoles: string[]): string[] {
  const mapped = entraRoles
    .map((role) => product.roleMap[role] ?? role)
    .filter((role) => role.length > 0);
  return [...new Set(mapped)].sort();
}

export function buildIdentity(input: {
  product: ProductConfig;
  tenant: TenantAccess;
  tenantId: string;
  userId: string;
  email?: string;
  name?: string;
  entraRoles: string[];
}): GatewayIdentity {
  return {
    productId: input.product.id,
    tenantId: input.tenantId,
    tenantName: input.tenant.name,
    userId: input.userId,
    email: input.email,
    name: input.name,
    roles: mapRoles(input.product, input.entraRoles),
  };
}
