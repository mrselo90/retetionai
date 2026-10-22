import { useCallback, useEffect } from "react";
import { useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

/**
 * Show an admin toast for a successful action, once per action result.
 *
 * Confirmations used to be success Banners that stayed on the page and pushed
 * content down. The App Bridge Toast is Shopify's native, non-blocking feedback.
 * Keep a Banner when the merchant must act on the message (e.g. an approval link).
 *
 * `result` is the action/fetcher data object: a new object means a new action,
 * so the same message after a second save toasts again.
 */
export function useActionToast(
  message: string | false | null | undefined,
  result: unknown,
  options?: { duration?: number; isError?: boolean },
) {
  const shopify = useAppBridge();
  const duration = options?.duration;
  const isError = options?.isError;

  useEffect(() => {
    if (!message || !result) return;
    shopify.toast.show(message, { duration, isError });
  }, [message, result, shopify, duration, isError]);
}

/**
 * Ask Shopify to show the App Store review modal when `when` turns true.
 *
 * Shopify decides whether it actually appears (eligibility, rate limits), and
 * advises asking at the end of a successful workflow rather than from a click.
 * Failures are ignored: a missing review prompt must never break the page.
 */
export function useReviewRequest(when: boolean) {
  const shopify = useAppBridge();

  useEffect(() => {
    if (!when) return;
    shopify.reviews.request().catch(() => undefined);
  }, [when, shopify]);
}

/**
 * Drive the Shopify admin's header loading bar from one page-level flag.
 *
 * The Loading API takes a boolean and does not count overlapping work, so the
 * caller passes a single derived value (router navigation, user submissions)
 * and this hook stops the bar when it unmounts.
 */
export function useAdminLoadingBar(active: boolean) {
  const shopify = useAppBridge();

  useEffect(() => {
    shopify.loading(active);
  }, [active, shopify]);

  useEffect(() => () => shopify.loading(false), [shopify]);
}

/**
 * Open a product in Shopify's own product editor (Intents API) and refresh the
 * page's data when the merchant saves, since title or image may have changed.
 * `productId` is our numeric Shopify id or a full GID.
 */
export function useEditProductInShopify() {
  const shopify = useAppBridge();
  const revalidator = useRevalidator();

  return useCallback(
    async (productId: string) => {
      const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

      if (!shopify.intents?.invoke) {
        // Older admin without intents: the product page itself.
        window.open(`shopify:admin/products/${gid.split("/").pop()}`, "_top");
        return;
      }

      const activity = await shopify.intents.invoke("edit:shopify/Product", { value: gid });
      const response = await activity.complete;
      if (response?.code === "ok") {
        shopify.toast.show("Product updated in Shopify");
        revalidator.revalidate();
      } else if (response?.code === "error") {
        shopify.toast.show(response.message || "Couldn't open the product editor", {
          isError: true,
        });
      }
    },
    [shopify, revalidator],
  );
}
