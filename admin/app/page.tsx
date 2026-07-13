import {
  createProductAction,
  updateProductAction,
  upsertRoleMappingAction,
  upsertTenantAccessAction,
} from "./products/actions";
import { listAdminProducts, type AdminProduct } from "../lib/products";

export const dynamic = "force-dynamic";

function ProductForm({ product }: { product?: AdminProduct }) {
  const action = product ? updateProductAction : createProductAction;
  const origins = product?.origins.join("\n") ?? "http://localhost:5173";

  return (
    <form className="form" action={action}>
      <label>
        Product slug
        <input name="slug" defaultValue={product?.slug ?? ""} readOnly={Boolean(product)} placeholder="fileguard" />
      </label>
      <label>
        Name
        <input name="name" defaultValue={product?.name ?? ""} placeholder="FileGuard" />
      </label>
      <label>
        App base URL
        <input name="appBaseUrl" defaultValue={product?.appBaseUrl ?? ""} placeholder="https://fileguard.helixrs.com" />
      </label>
      <label>
        Entra client ID
        <input name="clientId" defaultValue={product?.clientId ?? ""} placeholder="eeebd2df-bd9b-43b0-8763-0c47a8be0aad" />
      </label>
      <label>
        Client secret reference
        <input name="clientSecretRef" defaultValue={product?.clientSecretRef ?? "FILEGUARD_ENTRA_CLIENT_SECRET"} />
      </label>
      <label>
        Authority tenant
        <input name="authorityTenant" defaultValue={product?.authorityTenant ?? "00000000-0000-0000-0000-000000000000"} />
      </label>
      <label>
        Allowed return origins
        <textarea name="origins" defaultValue={origins} />
      </label>
      <button type="submit">{product ? "Update product" : "Create product"}</button>
    </form>
  );
}

function TenantForm({ product }: { product: AdminProduct }) {
  return (
    <form className="compact-form" action={upsertTenantAccessAction}>
      <input type="hidden" name="productId" value={product.id} />
      <input name="tenantId" placeholder="Tenant GUID" />
      <input name="tenantName" placeholder="Tenant name" />
      <select name="status" defaultValue="approved">
        <option value="approved">Approved</option>
        <option value="not_subscribed">Not subscribed</option>
        <option value="blocked">Blocked</option>
      </select>
      <input name="approvedBy" placeholder="Approved by" />
      <button type="submit">Save tenant</button>
    </form>
  );
}

function RoleMappingForm({ product }: { product: AdminProduct }) {
  return (
    <form className="compact-form" action={upsertRoleMappingAction}>
      <input type="hidden" name="productId" value={product.id} />
      <input name="entraRole" placeholder="Entra role, e.g. Admin" />
      <input name="gatewayRole" placeholder="Gateway role, e.g. admin" />
      <button type="submit">Save role</button>
    </form>
  );
}

export default async function Home() {
  const products = await listAdminProducts();
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  return (
    <main>
      <header>
        <div className="stack">
          <p className="muted">Helixrs Auth Gateway</p>
          <h1>Product Admin</h1>
        </div>
        <p className="muted">Backed by the identity config database</p>
      </header>

      {!databaseConfigured ? (
        <section className="panel warning stack">
          <h2>Database not configured</h2>
          <p className="muted">Set DATABASE_URL, run migrations, and restart the admin app to manage products.</p>
        </section>
      ) : null}

      <section className="grid">
        <div className="panel stack">
          <h2>Products</h2>
          <div className="product-list">
            {products.length === 0 ? <p className="muted">No products yet.</p> : null}
            {products.map((product) => (
              <div className="product-row" key={product.slug}>
                <div>
                  <h3>{product.name}</h3>
                  <p className="muted">{product.slug}</p>
                </div>
                <p className="muted">{product.appBaseUrl}</p>
                <span className="status active">configured</span>
                <p className="muted">
                  {product.tenantCount} tenants · {product.roleCount} roles
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel stack">
          <h2>Add product</h2>
          <ProductForm />
        </div>
      </section>

      {products.length > 0 ? (
        <section className="stack" style={{ marginTop: 18 }}>
          {products.map((product) => (
            <div className="panel stack" key={`${product.slug}-edit`}>
              <h2>Edit {product.name}</h2>
              <ProductForm product={product} />
              <div className="management-grid">
                <section className="stack">
                  <h3>Tenant access</h3>
                  <TenantForm product={product} />
                  <div className="table-list">
                    {product.tenants.length === 0 ? <p className="muted">No tenants configured.</p> : null}
                    {product.tenants.map((tenant) => (
                      <div className="detail-row" key={tenant.id}>
                        <div>
                          <strong>{tenant.tenantName}</strong>
                          <p className="muted">{tenant.tenantId}</p>
                        </div>
                        <span className={`status ${tenant.status}`}>{tenant.status.replace("_", " ")}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="stack">
                  <h3>Role mappings</h3>
                  <RoleMappingForm product={product} />
                  <div className="table-list">
                    {product.roleMappings.length === 0 ? <p className="muted">No role mappings configured.</p> : null}
                    {product.roleMappings.map((role) => (
                      <div className="detail-row" key={role.id}>
                        <strong>{role.entraRole}</strong>
                        <p className="muted">{role.gatewayRole}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
