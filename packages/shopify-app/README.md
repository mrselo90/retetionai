# Recete Shopify Shell

This package is the official Shopify-facing shell for Recete.

It will own:
- install and OAuth
- embedded app auth
- App Bridge bootstrap
- billing approval flow
- Shopify webhooks

It will not own:
- WhatsApp delivery logic
- AI generation
- queue workers
- merchant domain logic

Those remain in `packages/api` and `packages/workers`.

## Local development

Use Node `22.22.1` or newer in the supported range.

Copy envs:

```bash
cp packages/shopify-app/.env.example packages/shopify-app/.env
```

Then run:

```bash
pnpm dev:shopify
```

## Migration notes

This package is phase 1 of the Shopify shell migration.

Current status:
- official Shopify app scaffold is installed
- monorepo package shape is aligned
- API version is pinned to `2026-01`
- scopes and mandatory compliance topics are declared

Next phase:
- connect shell routes to `packages/api`
- transfer webhook ownership from the custom Hono routes
- move billing approval to the shell
