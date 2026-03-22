"use client";

import { useEffect } from "react";
import { useLocation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  type AppBridgeWithIdToken,
  getFreshToken,
  installAuthedFetch,
  uninstallAuthedFetch,
} from "../lib/sessionToken.client";

const SESSION_TOKEN_HEARTBEAT_MS = 45_000;

async function verifyEmbeddedSessionToken(
  pathname: string,
  search: string,
  sessionToken: string,
) {
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };

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
  const sessionToken = await getFreshToken(shopify);
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
    installAuthedFetch(shopify);

    return () => {
      uninstallAuthedFetch();
    };
  }, [shopify]);

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
