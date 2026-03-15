"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

async function verifyEmbeddedSessionToken(
  pathname: string,
  search: string,
  ready: Promise<void>,
  idToken: () => Promise<string>,
) {
  await ready;
  const token = await idToken();
  const response = await fetch(`/app/session-token${search}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ pathname }),
  });

  if (!response.ok) {
    throw new Error(`Embedded session token verification failed with ${response.status}`);
  }
}

export function EmbeddedSessionTokenBoundary() {
  const shopify = useAppBridge();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    void verifyEmbeddedSessionToken(
      location.pathname,
      location.search,
      shopify.ready,
      shopify.idToken,
    ).catch((error) => {
      if (!cancelled) {
        console.error(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, shopify]);

  return null;
}
