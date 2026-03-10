import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { syncShopInstall } from "./platform.server";

export const STARTER_MONTHLY_PLAN = "starter-monthly";
export const STARTER_YEARLY_PLAN = "starter-yearly";
export const PRO_MONTHLY_PLAN = "pro-monthly";
export const PRO_YEARLY_PLAN = "pro-yearly";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [STARTER_MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 29,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [STARTER_YEARLY_PLAN]: {
      lineItems: [
        {
          amount: 290,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
    [PRO_MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PRO_YEARLY_PLAN]: {
      lineItems: [
        {
          amount: 990,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
      ],
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      await syncShopInstall(session);
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
