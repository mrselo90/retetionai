import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";
import { useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="shellSection">
      <div className="shellSectionHeader">
        <div>
          <h2 className="shellSectionTitle">Products</h2>
          <p className="shellSectionText">
            Catalog rows currently available inside Recete for recipe mapping.
          </p>
        </div>
      </div>

      {data.products.length > 0 ? (
        <div className="shellList">
          {data.products.map((product) => (
            <div className="shellListItem" key={product.id}>
              <div className="shellListMain">
                <p className="shellListTitle">{product.name}</p>
                <p className="shellListMeta">
                  External ID: {product.external_id || "not linked"} · Updated{" "}
                  {product.updated_at
                    ? new Date(product.updated_at).toLocaleString()
                    : "unknown"}
                </p>
              </div>
              <span className="shellStatus shellStatusActive">ready</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="shellCard">
          <h3 className="shellCardTitle">No products visible yet</h3>
          <p className="shellSectionText">
            This merchant shell can authenticate and receive webhooks, but the
            catalog still needs to be brought into the mapped-product workflow.
          </p>
        </div>
      )}
    </section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
