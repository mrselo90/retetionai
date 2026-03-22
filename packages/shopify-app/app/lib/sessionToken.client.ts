"use client";

export type AppBridgeWithIdToken = {
  idToken?: () => Promise<string>;
};

type FetchLike = typeof window.fetch;

const EMBEDDED_PATH_PREFIXES = ["/app"];

export async function getFreshToken(shopify: AppBridgeWithIdToken) {
  if (typeof shopify.idToken !== "function") {
    throw new Error("Shopify App Bridge session token API is unavailable.");
  }

  console.debug("[shopify-auth] requesting token", {
    path: window.location.pathname,
    ts: Date.now(),
  });

  const token = (await shopify.idToken())?.trim();
  if (!token) {
    throw new Error("Missing Shopify session token.");
  }

  console.debug("[shopify-auth] token acquired", {
    path: window.location.pathname,
    tokenPrefix: token.slice(0, 12),
    ts: Date.now(),
  });

  return token;
}

function resolveRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return new URL(input, window.location.href);
  }

  if (input instanceof URL) {
    return new URL(input.toString(), window.location.href);
  }

  return new URL(input.url, window.location.href);
}

function shouldAttachToken(input: RequestInfo | URL) {
  const url = resolveRequestUrl(input);
  return (
    url.origin === window.location.origin &&
    EMBEDDED_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  );
}

export async function authedFetch(
  shopify: AppBridgeWithIdToken,
  input: RequestInfo | URL,
  init?: RequestInit,
  nativeFetch: FetchLike = window.fetch.bind(window),
) {
  if (!shouldAttachToken(input)) {
    return nativeFetch(input, init);
  }

  const token = await getFreshToken(shopify);
  const nextHeaders = new Headers(init?.headers);
  nextHeaders.set("Authorization", `Bearer ${token}`);
  nextHeaders.set("X-Requested-With", "XMLHttpRequest");

  return nativeFetch(input, {
    ...init,
    headers: nextHeaders,
  });
}

declare global {
  interface Window {
    __receteAuthedFetchInstalled__?: boolean;
    __receteOriginalFetch__?: typeof window.fetch;
  }
}

export function installAuthedFetch(shopify: AppBridgeWithIdToken) {
  if (typeof window === "undefined") return;
  if (window.__receteAuthedFetchInstalled__) return;

  const nativeFetch = window.fetch.bind(window);
  window.__receteOriginalFetch__ = nativeFetch;
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    authedFetch(shopify, input, init, nativeFetch)) as typeof window.fetch;
  window.__receteAuthedFetchInstalled__ = true;
}

export function uninstallAuthedFetch() {
  if (typeof window === "undefined") return;
  if (!window.__receteAuthedFetchInstalled__) return;
  if (window.__receteOriginalFetch__) {
    window.fetch = window.__receteOriginalFetch__;
  }
  window.__receteAuthedFetchInstalled__ = false;
}
