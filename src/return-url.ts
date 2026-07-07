import { HttpError } from "./http-error.js";
import type { ProductConfig } from "./types.js";

function allowedOrigins(product: ProductConfig): Set<string> {
  return new Set([new URL(product.appBaseUrl).origin, ...product.allowedReturnOrigins.map((url) => new URL(url).origin)]);
}

export function resolveReturnUrl(product: ProductConfig, rawReturnUrl?: string): string {
  if (!rawReturnUrl) {
    return product.appBaseUrl;
  }

  const base = new URL(product.appBaseUrl);
  const resolved = rawReturnUrl.startsWith("/")
    ? new URL(rawReturnUrl, base)
    : new URL(rawReturnUrl);

  if (!allowedOrigins(product).has(resolved.origin)) {
    throw new HttpError(400, "Return URL is not allowed for this product.", "invalid_return_url");
  }

  return resolved.toString();
}

export function appendQueryParam(url: string, key: string, value: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}
