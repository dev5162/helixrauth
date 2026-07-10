import { createProductAction, updateProductAction } from "./products/actions";
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
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
