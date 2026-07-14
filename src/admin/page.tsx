import type { AdminProduct } from "./products.js";

function ProductForm({ product }: { product?: AdminProduct }) {
  const action = product ? "/admin/products/update" : "/admin/products/create";
  const origins = product?.origins.join("\n") ?? "http://localhost:5173";

  return (
    <form className="form" action={action} method="post">
      <div className="form-row">
        <label>
          Product slug
          <input name="slug" defaultValue={product?.slug ?? ""} readOnly={Boolean(product)} placeholder="fileguard" />
        </label>
        <label>
          Name
          <input name="name" defaultValue={product?.name ?? ""} placeholder="FileGuard" />
        </label>
      </div>
      <div className="form-row">
        <label>
          App base URL
          <input name="appBaseUrl" defaultValue={product?.appBaseUrl ?? ""} placeholder="https://fileguard.helixrs.com" />
        </label>
        <label>
          Entra client ID
          <input name="clientId" defaultValue={product?.clientId ?? ""} placeholder="eeebd2df-bd9b-43b0-8763-0c47a8be0aad" />
        </label>
      </div>
      <div className="form-row">
        <label>
          Client secret reference
          <input name="clientSecretRef" defaultValue={product?.clientSecretRef ?? "FILEGUARD_ENTRA_CLIENT_SECRET"} />
        </label>
        <label>
          Authority tenant
          <input name="authorityTenant" defaultValue={product?.authorityTenant ?? "00000000-0000-0000-0000-000000000000"} />
        </label>
      </div>
      <label>
        Allowed return origins (one per line)
        <textarea name="origins" defaultValue={origins} />
      </label>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="form-actions">
        <button type="submit">{product ? "Update product" : "Create product"}</button>
      </div>
    </form>
  );
}

function TenantForm({ product }: { product: AdminProduct }) {
  return (
    <form className="compact-form" action="/admin/tenants" method="post">
      <input type="hidden" name="productId" value={product.id} />
      <input name="tenantId" placeholder="Tenant GUID" />
      <input name="tenantName" placeholder="Tenant name" />
      <select name="status" defaultValue="approved">
        <option value="approved">Approved</option>
        <option value="not_subscribed">Not subscribed</option>
        <option value="blocked">Blocked</option>
      </select>
      <input name="approvedBy" placeholder="Approved by" />
      <button type="submit">Save</button>
    </form>
  );
}

function RoleMappingForm({ product }: { product: AdminProduct }) {
  return (
    <form className="compact-form" action="/admin/roles" method="post">
      <input type="hidden" name="productId" value={product.id} />
      <input name="entraRole" placeholder="Entra role, e.g. Admin" />
      <input name="gatewayRole" placeholder="Gateway role, e.g. admin" />
      <button type="submit">Save</button>
    </form>
  );
}

export function AdminPage({ products, databaseConfigured }: { products: AdminProduct[]; databaseConfigured: boolean }) {
  const totalTenants = products.reduce((sum, p) => sum + p.tenantCount, 0);
  const totalRoles = products.reduce((sum, p) => sum + p.roleCount, 0);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">Helixrs Auth Gateway administration</p>
        </div>
      </header>

      {!databaseConfigured ? (
        <section className="panel warning stack">
          <div className="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h2>Database not configured</h2>
            <p className="muted">Set <code>DATABASE_URL</code>, run migrations, and restart the admin app to manage products.</p>
          </div>
        </section>
      ) : null}

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Products</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalTenants}</div>
          <div className="stat-label">Tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalRoles}</div>
          <div className="stat-label">Role mappings</div>
        </div>
      </section>

      <section id="products" className="section">
        <div className="section-header">
          <h2>Products</h2>
        </div>
        <div className="panel">
          {products.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No products configured yet. Add your first product below.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Base URL</th>
                    <th>Client ID</th>
                    <th>Tenants</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.slug} className="product-table-row">
                      <td><strong>{product.name}</strong></td>
                      <td><code>{product.slug}</code></td>
                      <td><span className="url-text">{product.appBaseUrl}</span></td>
                      <td><code className="code-sm">{product.clientId}</code></td>
                      <td>{product.tenantCount}</td>
                      <td>{product.roleCount}</td>
                      <td><span className="status active">configured</span></td>
                      <td>
                        <a className="button-icon" aria-label="Edit" href={`#edit-${product.slug}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Add product</h2>
        </div>
        <div className="panel">
          <ProductForm />
        </div>
      </section>

      {products.length > 0 ? (
        <section className="section stack">
          {products.map((product) => (
            <div className="panel stack product-detail" key={`${product.slug}-edit`} id={`edit-${product.slug}`}>
              <div className="product-detail-header">
                <div>
                  <h2>Edit {product.name}</h2>
                  <p className="muted">Manage configuration for <code>{product.slug}</code></p>
                </div>
              </div>

              <div className="tabs">
                <div className="tab active">Configuration</div>
              </div>

              <div className="tab-content">
                <ProductForm product={product} />
              </div>

              <div className="management-grid" id="tenants">
                <section className="stack">
                  <div className="section-header">
                    <h3>Tenant access</h3>
                    <span className="badge">{product.tenants.length}</span>
                  </div>
                  <TenantForm product={product} />
                  {product.tenants.length === 0 ? (
                    <div className="empty-state small">
                      <p className="muted">No tenants configured for this product.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table compact">
                        <thead>
                          <tr>
                            <th>Tenant name</th>
                            <th>Tenant ID</th>
                            <th>Status</th>
                            <th>Approved by</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.tenants.map((tenant) => (
                            <tr key={tenant.id}>
                              <td><strong>{tenant.tenantName}</strong></td>
                              <td><code className="code-sm">{tenant.tenantId}</code></td>
                              <td><span className={`status ${tenant.status}`}>{tenant.status.replace("_", " ")}</span></td>
                              <td>{tenant.approvedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                <section className="stack" id="roles">
                  <div className="section-header">
                    <h3>Role mappings</h3>
                    <span className="badge">{product.roleMappings.length}</span>
                  </div>
                  <RoleMappingForm product={product} />
                  {product.roleMappings.length === 0 ? (
                    <div className="empty-state small">
                      <p className="muted">No role mappings configured for this product.</p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table compact">
                        <thead>
                          <tr>
                            <th>Entra role</th>
                            <th>Gateway role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.roleMappings.map((role) => (
                            <tr key={role.id}>
                              <td><strong>{role.entraRole}</strong></td>
                              <td><code className="code-sm">{role.gatewayRole}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
