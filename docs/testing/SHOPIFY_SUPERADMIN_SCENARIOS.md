# Shopify Super Admin Scenario Suite

This document defines the Shopify-side validation suite that can now run from Super Admin at `/admin/testing`.

## Goal

- Validate end-to-end Shopify post-purchase behavior with real backend paths.
- Cover order ingestion, WhatsApp AI conversation quality, multilingual handling, and customer-intent flows.
- Provide one-click regression checks for release and incident follow-up.

## Automated Scenarios (Run from Super Admin)

These scenarios are served by `GET /api/admin/test-kit/shopify-scenarios` and executed by `POST /api/admin/test-kit/shopify-scenarios/run`.

| Scenario ID | Feature | What it validates |
| --- | --- | --- |
| `shopify_usage_how_tr` | Post-delivery usage guidance | Turkish usage question returns a non-empty, question-flow reply |
| `shopify_usage_frequency_tr` | Post-delivery usage guidance | Turkish frequency question is handled as guidance flow |
| `shopify_product_pick_numeric` | Order product resolution | Numeric product choice (`1`) resolves without “message incomplete” behavior |
| `shopify_routine_request` | Routine builder | Routine request in onboarding context is treated as actionable question |
| `shopify_return_intent_tr` | Return prevention / complaint routing | Return-intent language is classified into return or complaint handling |
| `shopify_opt_out_tr` | Unsubscribe handling | Opt-out language is classified correctly |
| `shopify_usage_how_en` | Multilingual support | English usage question works in same pipeline |
| `shopify_usage_how_de` | Multilingual support | German usage question works in same pipeline |
| `shopify_usage_how_hu` | Multilingual support | Hungarian usage question works in same pipeline |

## Execution Model

When you run the suite from Super Admin:

1. A test order is created via normalized Shopify-style events (`order_created` + `order_delivered`).
2. A test conversation context is prepared for that user/order.
3. Each scenario injects required seed context and sends a customer message through the same AI pipeline.
4. Assertions are evaluated per scenario:
   - non-empty AI reply
   - expected intent family (when defined)
   - expected guardrail state (when defined)
   - forbidden phrase checks (for known regressions)
5. The UI shows pass/fail summary and per-scenario assertion results.

## Shopify Feature Coverage Map

- Shopify order lifecycle ingestion: covered
- Post-delivery follow-up conversation entry: covered
- Order-product scoped question handling: covered
- Numeric product selection flow: covered
- Routine generation request flow: covered
- Return-intent classification path: covered
- Opt-out classification path: covered
- Multilingual usage questions (TR/EN/DE/HU): covered
- Live WhatsApp send path: available as manual toggle in single-message simulation

## Recommended Regression Routine

Run this suite:

- before production deploys affecting `api`, `shopify-app`, or AI logic
- after guardrail, intent, i18n, or retrieval changes
- after incident fixes in customer conversation quality
