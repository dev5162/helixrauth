import { getPool, sql } from "./pool.js";
import type { ProductConfig, TenantAccess } from "../types.js";

type ProductRow = {
  ID: number;
  Slug: string;
  Name: string;
  App_Base_Url: string;
  Client_ID: string | null;
  ClientSecretRef: string | null;
  AuthorityTenant: string | null;
  Scopes: string | null;
};

type OriginRow = {
  Origin: string;
};

type TenantRow = {
  Tenant_ID: string;
  Tenant_Name: string;
  Status: string;
};

type RoleRow = {
  Entra_Role: string;
  Gateway_Role: string;
};

function parseScopes(value: string | null): string[] {
  if (!value) {
    return ["openid", "profile", "email"];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
  } catch {
    return value
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
}

async function hydrateProduct(row: ProductRow): Promise<ProductConfig> {
  const pool = await getPool();
  const origins = await pool
    .request()
    .input("productId", sql.Int, row.ID)
    .query<OriginRow>("SELECT Origin FROM ProductRedirectOrigins WHERE Product_ID = @productId ORDER BY Origin");

  const tenants = await pool
    .request()
    .input("productId", sql.Int, row.ID)
    .query<TenantRow>(
      "SELECT CONVERT(nvarchar(36), Tenant_ID) AS Tenant_ID, Tenant_Name, Status FROM TenantPRoductAccess WHERE Product_ID = @productId",
    );

  const roles = await pool
    .request()
    .input("productId", sql.Int, row.ID)
    .query<RoleRow>("SELECT Entra_Role, Gateway_Role FROM ProductRoleMappings WHERE Product_ID = @productId");

  return {
    id: row.Slug,
    name: row.Name,
    appBaseUrl: row.App_Base_Url,
    allowedReturnOrigins: origins.recordset.map((origin) => origin.Origin),
    entra: {
      clientId: row.Client_ID ?? undefined,
      clientSecretRef: row.ClientSecretRef ?? undefined,
      authorityTenant: row.AuthorityTenant ?? "organizations",
      scopes: parseScopes(row.Scopes),
    },
    tenantAllowlist: tenants.recordset.map(
      (tenant): TenantAccess => ({
        tenantId: tenant.Tenant_ID,
        name: tenant.Tenant_Name,
        status: tenant.Status as TenantAccess["status"],
      }),
    ),
    roleMap: Object.fromEntries(roles.recordset.map((role) => [role.Entra_Role, role.Gateway_Role])),
  };
}

export async function listProductsFromDb(): Promise<ProductConfig[]> {
  const pool = await getPool();
  const result = await pool.request().query<ProductRow>(`
    SELECT
      p.ID,
      p.Slug,
      p.Name,
      p.App_Base_Url,
      CONVERT(nvarchar(36), e.Client_ID) AS Client_ID,
      e.ClientSecretRef,
      CONVERT(nvarchar(36), e.AuthorityTenant) AS AuthorityTenant,
      e.Scopes
    FROM Products p
    JOIN ProductEntraConfigs e ON e.Product_ID = p.ID
    ORDER BY p.Name
  `);

  return Promise.all(result.recordset.map(hydrateProduct));
}

export async function getProductFromDb(productSlug: string): Promise<ProductConfig | undefined> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("slug", sql.NVarChar(100), productSlug)
    .query<ProductRow>(`
      SELECT
        p.ID,
        p.Slug,
        p.Name,
        p.App_Base_Url,
        CONVERT(nvarchar(36), e.Client_ID) AS Client_ID,
        e.ClientSecretRef,
        CONVERT(nvarchar(36), e.AuthorityTenant) AS AuthorityTenant,
        e.Scopes
      FROM Products p
      JOIN ProductEntraConfigs e ON e.Product_ID = p.ID
      WHERE p.Slug = @slug
    `);

  return result.recordset[0] ? hydrateProduct(result.recordset[0]) : undefined;
}
