import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createMerchantProduct,
  deleteMerchantProduct,
  fetchMerchantProducts,
  generateMerchantProductEmbeddings,
  scrapeMerchantProduct,
} from "../platform.server";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantProducts(session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    switch (intent) {
      case "create": {
        const name = String(formData.get("name") || "").trim();
        const url = String(formData.get("url") || "").trim();
        if (!name || !url) {
          return {
            ok: false,
            error: "Name and URL are required.",
          } satisfies ActionResult;
        }

        await createMerchantProduct(session.shop, { name, url });
        return {
          ok: true,
          message: "Product created successfully.",
        } satisfies ActionResult;
      }

      case "scrape": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) {
          return { ok: false, error: "Missing product id." } satisfies ActionResult;
        }
        await scrapeMerchantProduct(session.shop, productId);
        return {
          ok: true,
          message: "Scrape completed and content was refreshed.",
        } satisfies ActionResult;
      }

      case "embeddings": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) {
          return { ok: false, error: "Missing product id." } satisfies ActionResult;
        }
        await generateMerchantProductEmbeddings(session.shop, productId);
        return {
          ok: true,
          message: "Embeddings generated successfully.",
        } satisfies ActionResult;
      }

      case "delete": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) {
          return { ok: false, error: "Missing product id." } satisfies ActionResult;
        }
        await deleteMerchantProduct(session.shop, productId);
        return {
          ok: true,
          message: "Product deleted successfully.",
        } satisfies ActionResult;
      }

      default:
        return { ok: false, error: "Unknown action." } satisfies ActionResult;
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Product action failed.",
    } satisfies ActionResult;
  }
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Products</h2>
            <p className="shellSectionText">
              Add products, scrape product pages, and generate embeddings from inside
              the Shopify shell.
            </p>
          </div>
          <span className="shellStatus shellStatusConnected">
            {data.products.length} products
          </span>
        </div>

        {actionData?.message ? (
          <div className="shellAlert shellAlertSuccess">{actionData.message}</div>
        ) : null}
        {actionData?.error ? (
          <div className="shellAlert shellAlertError">{actionData.error}</div>
        ) : null}

        <Form method="post" className="shellProductCreateForm">
          <input type="hidden" name="intent" value="create" />
          <label className="shellField">
            <span>Name</span>
            <input
              className="shellInput"
              type="text"
              name="name"
              placeholder="Hydrating cleanser"
              disabled={busy}
            />
          </label>
          <label className="shellField">
            <span>Product URL</span>
            <input
              className="shellInput"
              type="url"
              name="url"
              placeholder="https://example.com/products/hydrating-cleanser"
              disabled={busy}
            />
          </label>
          <button className="shellButton shellButtonPrimary shellButtonAsButton" type="submit" disabled={busy}>
            {busy ? "Working..." : "Add product"}
          </button>
        </Form>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Catalog workspace</h3>
            <p className="shellSectionText">
              Current merchant catalog inside Recete. Scrape refreshes product content and
              embeddings prepare it for recipe and RAG flows.
            </p>
          </div>
        </div>

        {data.products.length > 0 ? (
          <div className="shellList shellProductList">
            {data.products.map((product) => (
              <div className="shellListItem shellProductItem" key={product.id}>
                <div className="shellListMain">
                  <div className="shellProductHeader">
                    <p className="shellListTitle">{product.name}</p>
                    <div className="shellProductBadges">
                      <span className="shellStatus shellStatusConnected">
                        {product.chunkCount || 0} chunks
                      </span>
                      {product.raw_text ? (
                        <span className="shellStatus shellStatusActive">scraped</span>
                      ) : (
                        <span className="shellStatus shellStatusInactive">not scraped</span>
                      )}
                    </div>
                  </div>
                  <p className="shellListMeta">
                    {product.url}{" "}
                    {product.external_id ? `· External ID: ${product.external_id}` : ""}
                  </p>
                  <p className="shellListMeta">
                    Updated{" "}
                    {product.updated_at
                      ? new Date(product.updated_at).toLocaleString()
                      : "unknown"}
                  </p>
                </div>

                <div className="shellActionRow">
                  <Form method="post">
                    <input type="hidden" name="intent" value="scrape" />
                    <input type="hidden" name="productId" value={product.id} />
                    <button
                      className="shellButton shellButtonSecondary shellButtonAsButton"
                      type="submit"
                      disabled={busy}
                    >
                      Scrape
                    </button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="embeddings" />
                    <input type="hidden" name="productId" value={product.id} />
                    <button
                      className="shellButton shellButtonSecondary shellButtonAsButton"
                      type="submit"
                      disabled={busy}
                    >
                      Generate embeddings
                    </button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="productId" value={product.id} />
                    <button
                      className="shellButton shellButtonDanger shellButtonAsButton"
                      type="submit"
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="shellCard">
            <h3 className="shellCardTitle">No products visible yet</h3>
            <p className="shellSectionText">
              Add the first product above. The next step is scraping the product page
              so the AI pipeline can use it.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
