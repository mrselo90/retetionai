import type { Config } from "@react-router/dev/config";

// React Router 7.18 aborts UI-route actions whose Origin header doesn't match
// request.url. Behind nginx, react-router-serve builds request.url as http://
// (it doesn't trust X-Forwarded-Proto) while the embedded app posts from
// https://shop.recete.co.uk, so every action - session-token checks, Settings
// saves, product setup - came back 400. Allow the app's own host explicitly.
const appHost = (() => {
  try {
    return process.env.SHOPIFY_APP_URL ? new URL(process.env.SHOPIFY_APP_URL).host : null;
  } catch {
    return null;
  }
})();

export default {
  // Production deploys build into a folder per commit and run from it
  // (scripts/deploy/build-release.sh); everywhere else this is build/.
  buildDirectory: process.env.SHELL_BUILD_DIR || "build",
  allowedActionOrigins: [...new Set(["shop.recete.co.uk", ...(appHost ? [appHost] : [])])],
} satisfies Config;
