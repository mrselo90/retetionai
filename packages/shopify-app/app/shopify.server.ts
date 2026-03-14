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
import {
  DEFAULT_CAPPED_AMOUNT,
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
  getUsageTerms,
} from "./services/planDefinitions";
import { syncShopAfterAuth } from "./services/billingUsage.server";

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
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(STARTER_MONTHLY_PLAN),
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
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(STARTER_YEARLY_PLAN),
        },
      ],
    },
    [GROWTH_MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 69,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(GROWTH_MONTHLY_PLAN),
        },
      ],
    },
    [GROWTH_YEARLY_PLAN]: {
      lineItems: [
        {
          amount: 690,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(GROWTH_YEARLY_PLAN),
        },
      ],
    },
    [PRO_MONTHLY_PLAN]: {
      lineItems: [
        {
          amount: 199,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(PRO_MONTHLY_PLAN),
        },
      ],
    },
    [PRO_YEARLY_PLAN]: {
      lineItems: [
        {
          amount: 1990,
          currencyCode: "USD",
          interval: BillingInterval.Annual,
        },
        {
          amount: DEFAULT_CAPPED_AMOUNT,
          currencyCode: "USD",
          interval: BillingInterval.Usage,
          terms: getUsageTerms(PRO_YEARLY_PLAN),
        },
      ],
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      await syncShopAfterAuth(session.shop);
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
export {
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
};
export const apiVersion = ApiVersion.January26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
