import type { Config } from "@react-router/dev/config";

// React Router 7 CSRF-protects action (POST) submissions: when the request `Origin`
// differs from the server `Host` (after x-forwarded-host), the origin must be
// allow-listed here or the action is rejected with "Bad Request".
//
// `shopify app dev` serves the embedded app behind the Shopify CLI proxy, which
// REWRITES the browser Origin to `https://localhost:4040` while x-forwarded-host stays
// the public tunnel host (e.g. *.app.github.dev in Codespaces) — so Origin never
// matches Host, and the rewritten value isn't predictable across setups. In
// development we therefore allow any origin. In production the app is served
// same-origin from its own domain (Origin === Host, so the check is skipped) and the
// embedded iframe's `Origin: null` posts are covered explicitly. The Dockerfile sets
// NODE_ENV=production for the prod build, so the broad dev rule can never reach prod.
const isProd = process.env.NODE_ENV === "production";

export default {
  allowedActionOrigins: isProd
    ? ["null", "admin.shopify.com", "*.myshopify.com", "loop-loyalty.fly.dev"]
    : ["**", "null"],
} satisfies Config;
