import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";

function buildProductsUrl(productId?: string) {
  return productId
    ? `/app/products?product=${encodeURIComponent(productId)}`
    : "/app/products";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const productId = new URL(request.url).searchParams.get("product") || "";
  throw redirect(buildProductsUrl(productId));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const productId = String(
    formData.get("selected_product_id") || formData.get("product") || "",
  ).trim();
  throw redirect(buildProductsUrl(productId));
};

export default function ProductMappingRedirect() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
