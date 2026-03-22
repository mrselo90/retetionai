import type { LoaderFunctionArgs } from "react-router";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantProductInstructions, fetchMerchantProducts } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  const [localProducts, instructionPayload] = await Promise.all([
    fetchMerchantProducts(request),
    fetchMerchantProductInstructions(request),
  ]);

  return {
    localProducts: localProducts.products.map((product) => ({
      id: product.id,
      external_id: product.external_id,
    })),
    instructions: instructionPayload.instructions || [],
    localProductCount: localProducts.products.length,
  };
};
