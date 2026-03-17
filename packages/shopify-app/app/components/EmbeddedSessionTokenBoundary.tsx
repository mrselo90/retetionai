"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

const SESSION_TOKEN_HEARTBEAT_MS = 45_000;

type AppBridgeWithIdToken = {
  idToken?: () => Promise<string>;
};

async function resolveEmbeddedSessionToken(shopify: AppBridgeWithIdToken) {
  if (typeof shopify.idToken !== "function") {
    return null;
  }

  const token = await shopify.idToken();
  const trimmed = token?.trim();
  return trimmed ? trimmed : null;
}

async function verifyEmbeddedSessionToken(
  pathname: string,
  search: string,
  sessionToken: string | null,
) {
  // Prefer an explicit Authorization bearer token so the shell visibly uses
  // Shopify session-token auth. Keep the relative same-origin request so App
  // Bridge can still apply its embedded semantics.
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  return window.fetch(`/app/session-token${search}`, {
    method: "POST",
    headers,
    cache: "no-store",
    credentials: "same-origin",
    body: JSON.stringify({ pathname }),
  });
}

async function assertEmbeddedSessionToken(
  pathname: string,
  search: string,
  shopify: AppBridgeWithIdToken,
) {
  const sessionToken = await resolveEmbeddedSessionToken(shopify);
  
  // Wait until the session token is fully available before sending a heartbeat.
  // This prevents race conditions where the first API request is sent without
  // an Authorization header, causing the Shopify automated check to fail with 401.
  if (!sessionToken) {
    console.debug("Embedded session token is not yet available, skipping heartbeat.");
    return;
  }

  const response = await verifyEmbeddedSessionToken(pathname, search, sessionToken);
  if (response.ok) {
    return;
  }

  throw new Error(`Embedded session token verification failed with ${response.status}`);
}

export function EmbeddedSessionTokenBoundary() {
  const shopify = useAppBridge() as AppBridgeWithIdToken;
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const runVerification = () => {
      if (cancelled || inFlight) return;
      inFlight = true;

      void assertEmbeddedSessionToken(
        location.pathname,
        location.search,
        shopify,
      )
        .catch((error) => {
          if (!cancelled) {
            console.error(error);
          }
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runVerification();
      }
    };

    runVerification();

    const interval = window.setInterval(runVerification, SESSION_TOKEN_HEARTBEAT_MS);
    window.addEventListener("focus", runVerification);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", runVerification);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [location.pathname, location.search, shopify]);

  return null;
}
