import { loadConfig } from "../config.js";
import { closePool, getPool, sql } from "./pool.js";

function requiredGuid(value: string | undefined, label: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a GUID.`);
  }
  return value;
}

function authorityTenant(productAuthority: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productAuthority)) {
    return productAuthority;
  }

  return requiredGuid(
    process.env.DEFAULT_AUTHORITY_TENANT_ID ?? process.env.AZURE_TENANT_ID,
    "DEFAULT_AUTHORITY_TENANT_ID",
  );
}

async function main() {
  const config = loadConfig();
  const pool = await getPool(config.databaseUrl);
  const transaction = pool.transaction();

  await transaction.begin();

  try {
    for (const product of config.products) {
      const clientId = requiredGuid(
        product.entra.clientId ?? (product.entra.clientIdEnv ? process.env[product.entra.clientIdEnv] : undefined),
        `${product.id} client ID`,
      );
      const clientSecretRef = product.entra.clientSecretRef ?? product.entra.clientSecretEnv;
      if (!clientSecretRef) {
        throw new Error(`${product.id} client secret reference is required.`);
      }

      const productResult = await transaction
        .request()
        .input("slug", sql.NVarChar(100), product.id)
        .input("name", sql.NVarChar(200), product.name)
        .input("appBaseUrl", sql.NVarChar(500), product.appBaseUrl)
        .query<{ ID: number }>(`
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
        .input("clientId", sql.UniqueIdentifier, clientId)
        .input("clientSecretRef", sql.NVarChar(500), clientSecretRef)
        .input("authorityTenant", sql.UniqueIdentifier, authorityTenant(product.entra.authorityTenant))
        .input("scopes", sql.NVarChar(sql.MAX), JSON.stringify(product.entra.scopes))
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
      for (const origin of product.allowedReturnOrigins) {
        await transaction
          .request()
          .input("productId", sql.Int, productId)
          .input("origin", sql.NVarChar(500), origin)
          .query("INSERT INTO ProductRedirectOrigins (Product_ID, Origin) VALUES (@productId, @origin)");
      }

      await transaction.request().input("productId", sql.Int, productId).query("DELETE FROM ProductRoleMappings WHERE Product_ID = @productId");
      for (const [entraRole, gatewayRole] of Object.entries(product.roleMap)) {
        await transaction
          .request()
          .input("productId", sql.Int, productId)
          .input("entraRole", sql.NVarChar(200), entraRole)
          .input("gatewayRole", sql.NVarChar(200), gatewayRole)
          .query("INSERT INTO ProductRoleMappings (Product_ID, Entra_Role, Gateway_Role) VALUES (@productId, @entraRole, @gatewayRole)");
      }

      await transaction.request().input("productId", sql.Int, productId).query("DELETE FROM TenantPRoductAccess WHERE Product_ID = @productId");
      for (const tenant of product.tenantAllowlist) {
        await transaction
          .request()
          .input("productId", sql.Int, productId)
          .input("tenantId", sql.UniqueIdentifier, tenant.tenantId)
          .input("tenantName", sql.NVarChar(200), tenant.name)
          .input("status", sql.NVarChar(50), tenant.status)
          .query(`
            INSERT INTO TenantPRoductAccess (Product_ID, Tenant_ID, Tenant_Name, Status)
            VALUES (@productId, @tenantId, @tenantName, @status)
          `);
      }
    }

    await transaction.commit();
    console.log(`Seeded ${config.products.length} products`);
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
