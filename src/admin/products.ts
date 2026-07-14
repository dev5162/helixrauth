import { getAdminPool, sql } from "./db.js";

export type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  appBaseUrl: string;
  clientId: string | null;
  clientSecretRef: string | null;
  authorityTenant: string | null;
  origins: string[];
  tenants: AdminTenantAccess[];
  roleMappings: AdminRoleMapping[];
  tenantCount: number;
  roleCount: number;
};

export type AdminTenantAccess = {
  id: number;
  tenantId: string;
  tenantName: string;
  status: "approved" | "not_subscribed" | "blocked";
  approvedBy: string | null;
  approvedAt: Date | null;
};

export type AdminRoleMapping = {
  id: number;
  entraRole: string;
  gatewayRole: string;
};

export type ProductInput = {
  slug: string;
  name: string;
  appBaseUrl: string;
  clientId: string;
  clientSecretRef: string;
  authorityTenant: string;
  origins: string[];
};

export type TenantAccessInput = {
  productId: number;
  tenantId: string;
  tenantName: string;
  status: "approved" | "not_subscribed" | "blocked";
  approvedBy?: string;
};

export type RoleMappingInput = {
  productId: number;
  entraRole: string;
  gatewayRole: string;
};

type ProductRow = {
  ID: number;
  Slug: string;
  Name: string;
  App_Base_Url: string;
  Client_ID: string | null;
  ClientSecretRef: string | null;
  AuthorityTenant: string | null;
  TenantCount: number;
  RoleCount: number;
};

type OriginRow = {
  Origin: string;
};

type TenantRow = {
  ID: number;
  Tenant_ID: string;
  Tenant_Name: string;
  Status: "approved" | "not_subscribed" | "blocked";
  Approved_By: string | null;
  Approved_At: Date | null;
};

type RoleRow = {
  ID: number;
  Entra_Role: string;
  Gateway_Role: string;
};

export async function listAdminProducts(): Promise<AdminProduct[]> {
  const pool = await getAdminPool();
  if (!pool) {
    return [];
  }

  const result = await pool.request().query<ProductRow>(`
    SELECT
      p.ID,
      p.Slug,
      p.Name,
      p.App_Base_Url,
      CONVERT(nvarchar(36), e.Client_ID) AS Client_ID,
      e.ClientSecretRef,
      CONVERT(nvarchar(36), e.AuthorityTenant) AS AuthorityTenant,
      (SELECT COUNT(1) FROM TenantPRoductAccess t WHERE t.Product_ID = p.ID) AS TenantCount,
      (SELECT COUNT(1) FROM ProductRoleMappings r WHERE r.Product_ID = p.ID) AS RoleCount
    FROM Products p
    LEFT JOIN ProductEntraConfigs e ON e.Product_ID = p.ID
    ORDER BY p.Name
  `);

  return Promise.all(
    result.recordset.map(async (row) => {
      const origins = await pool
        .request()
        .input("productId", sql.Int, row.ID)
        .query<OriginRow>("SELECT Origin FROM ProductRedirectOrigins WHERE Product_ID = @productId ORDER BY Origin");
      const tenants = await pool
        .request()
        .input("productId", sql.Int, row.ID)
        .query<TenantRow>(`
          SELECT
            ID,
            CONVERT(nvarchar(36), Tenant_ID) AS Tenant_ID,
            Tenant_Name,
            Status,
            Approved_By,
            Approved_At
          FROM TenantPRoductAccess
          WHERE Product_ID = @productId
          ORDER BY Tenant_Name
        `);
      const roleMappings = await pool
        .request()
        .input("productId", sql.Int, row.ID)
        .query<RoleRow>(`
          SELECT ID, Entra_Role, Gateway_Role
          FROM ProductRoleMappings
          WHERE Product_ID = @productId
          ORDER BY Entra_Role
        `);

      return {
        id: row.ID,
        slug: row.Slug,
        name: row.Name,
        appBaseUrl: row.App_Base_Url,
        clientId: row.Client_ID,
        clientSecretRef: row.ClientSecretRef,
        authorityTenant: row.AuthorityTenant,
        origins: origins.recordset.map((origin) => origin.Origin),
        tenants: tenants.recordset.map((tenant) => ({
          id: tenant.ID,
          tenantId: tenant.Tenant_ID,
          tenantName: tenant.Tenant_Name,
          status: tenant.Status,
          approvedBy: tenant.Approved_By,
          approvedAt: tenant.Approved_At,
        })),
        roleMappings: roleMappings.recordset.map((role) => ({
          id: role.ID,
          entraRole: role.Entra_Role,
          gatewayRole: role.Gateway_Role,
        })),
        tenantCount: Number(row.TenantCount),
        roleCount: Number(row.RoleCount),
      };
    }),
  );
}

export async function createProduct(input: ProductInput): Promise<void> {
  const pool = await requireAdminPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    await upsertProduct(transaction, input);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

export async function updateProduct(input: ProductInput): Promise<void> {
  await createProduct(input);
}

export async function upsertTenantAccess(input: TenantAccessInput): Promise<void> {
  const pool = await requireAdminPool();
  await pool
    .request()
    .input("productId", sql.Int, input.productId)
    .input("tenantId", sql.UniqueIdentifier, input.tenantId)
    .input("tenantName", sql.NVarChar(200), input.tenantName)
    .input("status", sql.NVarChar(50), input.status)
    .input("approvedBy", sql.NVarChar(200), input.approvedBy || null)
    .query(`
      MERGE TenantPRoductAccess AS target
      USING (
        SELECT
          @productId AS Product_ID,
          @tenantId AS Tenant_ID,
          @tenantName AS Tenant_Name,
          @status AS Status,
          @approvedBy AS Approved_By
      ) AS source
        ON target.Product_ID = source.Product_ID AND target.Tenant_ID = source.Tenant_ID
      WHEN MATCHED THEN
        UPDATE SET
          Tenant_Name = source.Tenant_Name,
          Status = source.Status,
          Approved_By = source.Approved_By,
          Approved_At = CASE WHEN source.Status = 'approved' THEN COALESCE(target.Approved_At, SYSUTCDATETIME()) ELSE NULL END
      WHEN NOT MATCHED THEN
        INSERT (Product_ID, Tenant_ID, Tenant_Name, Status, Approved_By, Approved_At)
        VALUES (
          source.Product_ID,
          source.Tenant_ID,
          source.Tenant_Name,
          source.Status,
          source.Approved_By,
          CASE WHEN source.Status = 'approved' THEN SYSUTCDATETIME() ELSE NULL END
        );
    `);
}

export async function upsertRoleMapping(input: RoleMappingInput): Promise<void> {
  const pool = await requireAdminPool();
  await pool
    .request()
    .input("productId", sql.Int, input.productId)
    .input("entraRole", sql.NVarChar(200), input.entraRole)
    .input("gatewayRole", sql.NVarChar(200), input.gatewayRole)
    .query(`
      MERGE ProductRoleMappings AS target
      USING (
        SELECT
          @productId AS Product_ID,
          @entraRole AS Entra_Role,
          @gatewayRole AS Gateway_Role
      ) AS source
        ON target.Product_ID = source.Product_ID AND target.Entra_Role = source.Entra_Role
      WHEN MATCHED THEN
        UPDATE SET Gateway_Role = source.Gateway_Role
      WHEN NOT MATCHED THEN
        INSERT (Product_ID, Entra_Role, Gateway_Role)
        VALUES (source.Product_ID, source.Entra_Role, source.Gateway_Role);
    `);
}

async function requireAdminPool(): Promise<sql.ConnectionPool> {
  const pool = await getAdminPool();
  if (!pool) {
    throw new Error("DATABASE_URL is required to manage products.");
  }
  return pool;
}

async function upsertProduct(transaction: sql.Transaction, input: ProductInput): Promise<void> {
  const request = transaction.request();
  request.input("slug", sql.NVarChar(100), input.slug);
  request.input("name", sql.NVarChar(200), input.name);
  request.input("appBaseUrl", sql.NVarChar(500), input.appBaseUrl);

  const productResult = await request.query<{ ID: number }>(`
    MERGE Products AS target
    USING (SELECT @slug AS Slug, @name AS Name, @appBaseUrl AS App_Base_Url) AS source
      ON target.Slug = source.Slug
    WHEN MATCHED THEN
      UPDATE SET Name = source.Name, App_Base_Url = source.App_Base_Url, Updated_At = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (Slug, Name, App_Base_Url)
      VALUES (source.Slug, source.Name, source.App_Base_Url)
    OUTPUT inserted.ID;
  `);

  const productId = productResult.recordset[0].ID;

  await transaction
    .request()
    .input("productId", sql.Int, productId)
    .input("clientId", sql.UniqueIdentifier, input.clientId)
    .input("clientSecretRef", sql.NVarChar(500), input.clientSecretRef)
    .input("authorityTenant", sql.UniqueIdentifier, input.authorityTenant)
    .input("scopes", sql.NVarChar(sql.MAX), JSON.stringify(["openid", "profile", "email"]))
    .query(`
      MERGE ProductEntraConfigs AS target
      USING (
        SELECT
          @productId AS Product_ID,
          @clientId AS Client_ID,
          @clientSecretRef AS ClientSecretRef,
          @authorityTenant AS AuthorityTenant,
          @scopes AS Scopes
      ) AS source
        ON target.Product_ID = source.Product_ID
      WHEN MATCHED THEN
        UPDATE SET
          Client_ID = source.Client_ID,
          ClientSecretRef = source.ClientSecretRef,
          AuthorityTenant = source.AuthorityTenant,
          Scopes = source.Scopes
      WHEN NOT MATCHED THEN
        INSERT (Product_ID, Client_ID, ClientSecretRef, AuthorityTenant, Scopes)
        VALUES (source.Product_ID, source.Client_ID, source.ClientSecretRef, source.AuthorityTenant, source.Scopes);
    `);

  await transaction.request().input("productId", sql.Int, productId).query("DELETE FROM ProductRedirectOrigins WHERE Product_ID = @productId");

  for (const origin of input.origins) {
    await transaction
      .request()
      .input("productId", sql.Int, productId)
      .input("origin", sql.NVarChar(500), origin)
      .query("INSERT INTO ProductRedirectOrigins (Product_ID, Origin) VALUES (@productId, @origin)");
  }
}
