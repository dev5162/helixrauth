import {
  createProduct,
  updateProduct,
  upsertRoleMapping,
  upsertTenantAccess,
  type ProductInput,
  type RoleMappingInput,
  type TenantAccessInput,
} from "./products.js";

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function productInputFromForm(body: Record<string, unknown>): ProductInput {
  return {
    slug: requiredString(body, "slug"),
    name: requiredString(body, "name"),
    appBaseUrl: requiredString(body, "appBaseUrl"),
    clientId: requiredString(body, "clientId"),
    clientSecretRef: requiredString(body, "clientSecretRef"),
    authorityTenant: requiredString(body, "authorityTenant"),
    origins: requiredString(body, "origins")
      .split(/\r?\n|,/)
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

function numberFromForm(body: Record<string, unknown>, key: string): number {
  const parsed = Number(requiredString(body, key));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}

function optionalString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function tenantAccessInputFromForm(body: Record<string, unknown>): TenantAccessInput {
  const rawStatus = requiredString(body, "status");
  const status =
    rawStatus === "approved" || rawStatus === "not_subscribed" || rawStatus === "blocked"
      ? rawStatus
      : "blocked";

  return {
    productId: numberFromForm(body, "productId"),
    tenantId: requiredString(body, "tenantId"),
    tenantName: requiredString(body, "tenantName"),
    status,
    approvedBy: optionalString(body, "approvedBy"),
  };
}

function roleMappingInputFromForm(body: Record<string, unknown>): RoleMappingInput {
  return {
    productId: numberFromForm(body, "productId"),
    entraRole: requiredString(body, "entraRole"),
    gatewayRole: requiredString(body, "gatewayRole"),
  };
}

export async function createProductAction(body: Record<string, unknown>): Promise<void> {
  await createProduct(productInputFromForm(body));
}

export async function updateProductAction(body: Record<string, unknown>): Promise<void> {
  await updateProduct(productInputFromForm(body));
}

export async function upsertTenantAccessAction(body: Record<string, unknown>): Promise<void> {
  await upsertTenantAccess(tenantAccessInputFromForm(body));
}

export async function upsertRoleMappingAction(body: Record<string, unknown>): Promise<void> {
  await upsertRoleMapping(roleMappingInputFromForm(body));
}
