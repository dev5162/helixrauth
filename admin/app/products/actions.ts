"use server";

import { revalidatePath } from "next/cache";
import { createProduct, updateProduct, type ProductInput } from "../../lib/products";

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

export async function createProductAction(formData: FormData) {
  await createProduct(productInputFromForm(formData));
  revalidatePath("/");
}

export async function updateProductAction(formData: FormData) {
  await updateProduct(productInputFromForm(formData));
  revalidatePath("/");
}
