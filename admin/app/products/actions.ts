"use server";

import { revalidatePath } from "next/cache";
import {
  createProduct,
  updateProduct,
  upsertRoleMapping,
  upsertTenantAccess,
  type ProductInput,
  type RoleMappingInput,
  type TenantAccessInput,
} from "../../lib/products";

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function productInputFromForm(formData: FormData): ProductInput {
  return {
    slug: requiredString(formData, "slug"),
    name: requiredString(formData, "name"),
    appBaseUrl: requiredString(formData, "appBaseUrl"),
    clientId: requiredString(formData, "clientId"),
    clientSecretRef: requiredString(formData, "clientSecretRef"),
    authorityTenant: requiredString(formData, "authorityTenant"),
    origins: requiredString(formData, "origins")
      .split(/\r?\n|,/)
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

function numberFromForm(formData: FormData, key: string): number {
  const parsed = Number(requiredString(formData, key));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}

function optionalString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function tenantAccessInputFromForm(formData: FormData): TenantAccessInput {
  const rawStatus = requiredString(formData, "status");
  const status =
    rawStatus === "approved" || rawStatus === "not_subscribed" || rawStatus === "blocked"
      ? rawStatus
      : "blocked";

  return {
    productId: numberFromForm(formData, "productId"),
    tenantId: requiredString(formData, "tenantId"),
    tenantName: requiredString(formData, "tenantName"),
    status,
    approvedBy: optionalString(formData, "approvedBy"),
  };
}

function roleMappingInputFromForm(formData: FormData): RoleMappingInput {
  return {
    productId: numberFromForm(formData, "productId"),
    entraRole: requiredString(formData, "entraRole"),
    gatewayRole: requiredString(formData, "gatewayRole"),
  };
}

export async function createProductAction(formData: FormData) {
  await createProduct(productInputFromForm(formData));
  revalidatePath("/");
}

export async function updateProductAction(formData: FormData) {
  await updateProduct(productInputFromForm(formData));
  revalidatePath("/");
}

export async function upsertTenantAccessAction(formData: FormData) {
  await upsertTenantAccess(tenantAccessInputFromForm(formData));
  revalidatePath("/");
}

export async function upsertRoleMappingAction(formData: FormData) {
  await upsertRoleMapping(roleMappingInputFromForm(formData));
  revalidatePath("/");
}
