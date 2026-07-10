import { getProductFromDb } from "./db/products.js";
import type { AppConfig, ProductConfig } from "./types.js";

export async function getProduct(config: AppConfig, productId: string): Promise<ProductConfig | undefined> {
  if (config.databaseUrl) {
    return getProductFromDb(productId);
  }

  return config.products.find((product) => product.id === productId);
}
