"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

async function verifyWithAutomaticFetch(pathname: string, search: string) {
  return fetch(`/app/session-token${search}`, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ pathname }),
  });
}

async function verifyWithManualBearerToken(
  pathname: string,
  search: string,
  idToken: () => Promise<string>,
) {
  const token = await idToken();
  return fetch(`/app/session-token${search}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ pathname }),
  });
}

async function verifyEmbeddedSessionToken(
  pathname: string,
  search: string,
  ready: Promise<void>,
  idToken: () => Promise<string>,
) {
  await ready;

  const automaticResponse = await verifyWithAutomaticFetch(pathname, search);
  if (automaticResponse.ok) {
    return;
  }

  const manualResponse = await verifyWithManualBearerToken(pathname, search, idToken);
  if (manualResponse.ok) {
    return;
  }

  throw new Error(
    `Embedded session token verification failed with ${manualResponse.status}`,
  );
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
