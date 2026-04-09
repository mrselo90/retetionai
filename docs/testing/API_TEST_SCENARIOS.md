# API Test Scenarios

## Scope

This document defines functional API test scenarios for the current backend route surface mounted in `packages/api/src/index.ts`.

It is intended for:
- automated integration tests in `packages/api/src/test/integration`
- manual QA on staging for external-provider flows
- release regression checks

## Scenario Model

Each endpoint should be covered across these dimensions where applicable:

- `happy_path`: valid request returns expected success response
- `auth_missing`: missing auth is rejected
- `auth_invalid`: invalid auth or wrong merchant scope is rejected
- `validation_error`: malformed body/query/path is rejected
- `not_found`: referenced resource does not exist
- `provider_error`: dependency failure returns safe error
- `state_conflict`: duplicate, invalid transition, or already-processed state is handled correctly
- `idempotency`: repeated request does not corrupt state

## Priorities

- `P0`: login, webhooks, product CRUD, message sending, billing, health
- `P1`: merchant settings, conversations, analytics, customers, Shopify, GDPR
- `P2`: admin, test/support flows, non-critical read endpoints

## Global Scenarios

These scenarios apply to most protected endpoints and should be reused as shared test helpers.

| ID | Applies To | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| G-01 | All protected endpoints | Valid auth for correct merchant | `200/201` and data scoped to merchant | P0 |
| G-02 | All protected endpoints | Missing auth header | `401` or equivalent auth rejection | P0 |
| G-03 | All protected endpoints | Invalid/expired auth token | `401` | P0 |
| G-04 | Merchant-scoped read/write endpoints | Valid auth for different merchant | `403` or `404`; no cross-tenant leakage | P0 |
| G-05 | Endpoints with path params | Invalid UUID or malformed path param | `400` | P1 |
| G-06 | Endpoints with JSON body | Invalid JSON or wrong field types | `400` | P0 |
| G-07 | Endpoints with pagination/filter query | Invalid query values | `400` | P1 |
| G-08 | Endpoints with writes | Dependency failure from DB/Redis/queue/provider | `500` or mapped safe error, no partial corruption | P0 |
| G-09 | Rate-limited endpoints | Burst over allowed threshold | `429` with rate-limit headers | P1 |
| G-10 | Public endpoints | No auth required | Successful response without auth | P0 |

## Public / System

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| SYS-01 | `GET /` | Basic health landing | `200` with name/version/status | P2 |
| SYS-02 | `GET /health` | DB and Redis both healthy | `200`, services marked connected | P0 |
| SYS-03 | `GET /health` | DB or Redis unavailable | `503`, unhealthy service surfaced | P0 |
| SYS-04 | `GET /api/config/platform-contact` | Corporate WhatsApp config exists | `200` with configured number | P1 |
| SYS-05 | `GET /api/config/platform-contact` | Config lookup fails | `200` with fallback number | P1 |
| SYS-06 | `GET /api/docs` | Swagger UI reachable | `200` HTML response | P2 |
| SYS-07 | `GET /api/docs/openapi.json` | Spec endpoint reachable | `200` JSON response | P2 |

## Auth

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| AUTH-01 | `POST /api/auth/signup` | New merchant signup with valid body | `201`, merchant created | P0 |
| AUTH-02 | `POST /api/auth/signup` | Duplicate email with existing merchant | `409` | P0 |
| AUTH-03 | `POST /api/auth/signup` | Existing auth user but missing merchant record | Merchant record created or recovered successfully | P1 |
| AUTH-04 | `POST /api/auth/signup` | Invalid email/password/name | `400` | P0 |
| AUTH-05 | `POST /api/auth/signup` | Merchant insert fails after auth user creation | `500`, rollback attempted | P1 |
| AUTH-06 | `POST /api/auth/login` | Valid credentials | `200`, merchant and session returned | P0 |
| AUTH-07 | `POST /api/auth/login` | Invalid credentials | `401` | P0 |
| AUTH-08 | `POST /api/auth/login` | Auth succeeds but merchant missing | Self-healing merchant creation succeeds | P1 |
| AUTH-09 | `GET /api/auth/me` | Current merchant exists | `200` with merchant profile | P0 |
| AUTH-10 | `GET /api/auth/me` | Auth valid but merchant missing | `404` | P1 |

## Merchants

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| MER-01 | `GET /api/merchants/me` | Merchant profile fetch | `200` with current merchant data | P1 |
| MER-02 | `PUT /api/merchants/me` | Valid profile update | `200`, fields updated | P1 |
| MER-03 | `PUT /api/merchants/me` | Invalid profile payload | `400` | P1 |
| MER-04 | `GET /api/merchants/me/multi-lang-rag-settings` | Settings exist | `200` with persisted settings | P1 |
| MER-05 | `PUT /api/merchants/me/multi-lang-rag-settings` | Valid settings change | `200`, settings saved | P1 |
| MER-06 | `PUT /api/merchants/me/multi-lang-rag-settings` | Unsupported locale or malformed config | `400` | P1 |
| MER-07 | `GET /api/merchants/me/guardrails` | Guardrails fetch | `200` | P1 |
| MER-08 | `PUT /api/merchants/me/guardrails` | Valid guardrail update | `200`, values persisted | P1 |
| MER-09 | `PUT /api/merchants/me/guardrails` | Invalid action or malformed rule | `400` | P1 |
| MER-10 | `GET /api/merchants/me/bot-info` | Bot info fetch | `200` | P1 |
| MER-11 | `PUT /api/merchants/me/bot-info` | Valid bot/persona update | `200` | P1 |
| MER-12 | `PUT /api/merchants/me/bot-info` | Invalid persona fields | `400` | P1 |
| MER-13 | `GET /api/merchants/me/stats` | Merchant stats available | `200` with counts/summary | P1 |

## Members

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| MEM-01 | `GET /api/merchants/me/members` | List team members | `200` with member list | P1 |
| MEM-02 | `POST /api/merchants/me/members/invite` | Invite valid email | `201/200`, invite/member created | P1 |
| MEM-03 | `POST /api/merchants/me/members/invite` | Duplicate invite/email already member | Conflict-safe error | P1 |
| MEM-04 | `POST /api/merchants/me/members/invite` | Invalid email/role | `400` | P1 |
| MEM-05 | `PUT /api/merchants/me/members/:id` | Update member role/status | `200` | P1 |
| MEM-06 | `PUT /api/merchants/me/members/:id` | Member not found | `404` | P1 |
| MEM-07 | `DELETE /api/merchants/me/members/:id` | Remove member | `200` | P1 |
| MEM-08 | `DELETE /api/merchants/me/members/:id` | Attempt removing missing member | `404` | P1 |

## Integrations

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| INT-01 | `GET /api/integrations` | Merchant has integrations | `200` list | P1 |
| INT-02 | `GET /api/integrations` | No integrations | `200` empty list | P1 |
| INT-03 | `POST /api/integrations` | Create valid manual integration | `201` | P1 |
| INT-04 | `POST /api/integrations` | Create valid WhatsApp Meta integration | `201` | P1 |
| INT-05 | `POST /api/integrations` | Create valid WhatsApp Twilio integration | `201` | P1 |
| INT-06 | `POST /api/integrations` | Invalid provider/auth_type | `400` | P1 |
| INT-07 | `POST /api/integrations` | Missing provider-specific auth_data | `400` | P1 |
| INT-08 | `POST /api/integrations` | Duplicate provider for merchant | conflict-safe response | P1 |
| INT-09 | `GET /api/integrations/:id` | Existing integration | `200` | P1 |
| INT-10 | `GET /api/integrations/:id` | Integration belongs to another merchant | `404` | P0 |
| INT-11 | `PUT /api/integrations/:id` | Valid integration update | `200` | P1 |
| INT-12 | `PUT /api/integrations/:id` | Invalid update payload | `400` | P1 |
| INT-13 | `DELETE /api/integrations/:id` | Delete integration | `200` | P1 |
| INT-14 | `DELETE /api/integrations/:id` | Missing integration | `404` | P1 |

## CSV Import

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| CSV-01 | `POST /api/integrations/:integrationId/import/csv` | Valid CSV import for owned integration | `200/202`, rows processed | P1 |
| CSV-02 | `POST /api/integrations/:integrationId/import/csv` | Missing file/body data | `400` | P1 |
| CSV-03 | `POST /api/integrations/:integrationId/import/csv` | Invalid CSV format | `400` with row errors | P1 |
| CSV-04 | `POST /api/integrations/:integrationId/import/csv` | Integration not found or wrong merchant | `404` | P1 |
| CSV-05 | `GET /api/integrations/csv/template` | Template fetch | `200` downloadable template | P2 |

## Shopify

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| SH-01 | `POST /api/integrations/shopify/install-sync` | Valid install sync payload | `200/201`, merchant/integration synced | P0 |
| SH-02 | `POST /api/integrations/shopify/install-sync` | Missing internal secret or invalid payload | `401/400` | P0 |
| SH-03 | `GET /api/integrations/shopify/merchant-overview` | Authorized merchant fetches overview | `200` | P1 |
| SH-04 | `POST /api/integrations/shopify/auth` | Start auth with valid context | `200` or redirect payload | P1 |
| SH-05 | `POST /api/integrations/shopify/auth` | Missing merchant/shop context | `400` | P1 |
| SH-06 | `GET /api/integrations/shopify/oauth/callback` | Valid callback params | success redirect or success JSON | P0 |
| SH-07 | `GET /api/integrations/shopify/oauth/callback` | Invalid HMAC/state/code | safe failure path | P0 |
| SH-08 | `POST /api/integrations/shopify/webhooks/subscribe` | Authorized resubscribe | `200` | P1 |
| SH-09 | `GET /api/integrations/shopify/products` | Authorized product sync fetch | `200` product list | P1 |
| SH-10 | `GET /api/integrations/shopify/products` | Upstream Shopify failure | safe error | P1 |
| SH-11 | `POST /api/integrations/shopify/verify-session` | Valid embedded session token | `200` with merchant context | P0 |
| SH-12 | `POST /api/integrations/shopify/verify-session` | Invalid token | `401` | P0 |

## Products

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| PROD-01 | `GET /api/products` | List merchant products | `200` with merchant-only products | P0 |
| PROD-02 | `GET /api/products` | Empty product list | `200` empty list | P1 |
| PROD-03 | `POST /api/products` | Create product with valid body | `201` | P0 |
| PROD-04 | `POST /api/products` | Invalid product payload | `400` | P0 |
| PROD-05 | `GET /api/products/:id` | Existing owned product | `200` with product and computed health | P0 |
| PROD-06 | `GET /api/products/:id` | Missing or foreign product | `404` | P0 |
| PROD-07 | `PUT /api/products/:id` | Valid product update | `200` | P0 |
| PROD-08 | `PUT /api/products/:id` | Invalid update payload | `400` | P1 |
| PROD-09 | `DELETE /api/products/:id` | Delete owned product | `200` | P0 |
| PROD-10 | `DELETE /api/products/:id` | Missing product | `404` | P1 |
| PROD-11 | `GET /api/products/mapping-index` | Mapping index fetch | `200` | P2 |
| PROD-12 | `GET /api/products/instructions/list` | Instruction list fetch | `200` | P1 |
| PROD-13 | `GET /api/products/:id/instruction` | Existing instruction | `200` | P1 |
| PROD-14 | `GET /api/products/:id/instruction` | Product exists but no instruction yet | `200` empty/default payload or `404`, per contract | P1 |
| PROD-15 | `PUT /api/products/:id/instruction` | Valid usage instruction update | `200` | P1 |
| PROD-16 | `PUT /api/products/:id/instruction` | Invalid instruction body | `400` | P1 |
| PROD-17 | `POST /api/products/:id/scrape` | Immediate scrape success | `200`, product content updated | P0 |
| PROD-18 | `POST /api/products/:id/scrape` | Scraper fails or URL invalid | safe error | P0 |
| PROD-19 | `POST /api/products/:id/scrape-async` | Queue scrape job | `200/202` with job id | P1 |
| PROD-20 | `POST /api/products/scrape-batch` | Batch scrape for valid product ids | `200/202` | P1 |
| PROD-21 | `POST /api/products/scrape-batch` | Batch contains foreign or missing ids | partial failure handled safely | P1 |
| PROD-22 | `POST /api/products/:id/generate-embeddings` | Embeddings generated for owned product | `200` with chunk counts | P0 |
| PROD-23 | `POST /api/products/:id/generate-embeddings` | Product missing raw content | safe validation/business error | P0 |
| PROD-24 | `POST /api/products/generate-embeddings-batch` | Batch embeddings for valid products | `200/202` | P1 |
| PROD-25 | `POST /api/products/enrich` | Product enrichment success | `200` enriched result | P1 |
| PROD-26 | `POST /api/products/enrich` | LLM/provider failure | safe error | P1 |
| PROD-27 | `GET /api/products/:id/chunks` | Retrieve chunk list | `200` | P1 |
| PROD-28 | `GET /api/products/:id/chunks` | No chunks present | `200` empty list | P1 |
| PROD-29 | `POST /api/products/chunks/batch` | Batch chunk fetch | `200` | P1 |

## RAG / Answer

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| RAG-01 | `POST /api/rag/query` | Valid merchant-scoped RAG query | `200` grounded answer/context | P1 |
| RAG-02 | `POST /api/rag/query` | Missing query text or invalid body | `400` | P1 |
| RAG-03 | `POST /api/rag/query` | No knowledge base available | safe fallback answer | P1 |
| RAG-04 | `GET /api/rag/order/:orderId/context` | Existing order context | `200` | P1 |
| RAG-05 | `GET /api/rag/order/:orderId/context` | Missing order | `404` or empty context | P1 |
| RAG-06 | `POST /api/rag/test` | Internal/diagnostic test run | `200` | P2 |
| RAG-07 | `POST /api/answer` | Valid answer request | `200` | P0 |
| RAG-08 | `POST /api/answer` | Missing merchant context or invalid payload | `400/401` | P0 |
| RAG-09 | `POST /api/answer` | Model/provider failure | safe error | P0 |

## WhatsApp

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| WA-01 | `GET /api/whatsapp/webhooks/whatsapp` | Valid verification challenge | `200` with challenge | P0 |
| WA-02 | `GET /api/whatsapp/webhooks/whatsapp` | Invalid verify token | `403` | P0 |
| WA-03 | `POST /api/whatsapp/webhooks/whatsapp` | Valid inbound webhook signature | `200` and event stored/queued | P0 |
| WA-04 | `POST /api/whatsapp/webhooks/whatsapp` | Invalid signature | `401/403` | P0 |
| WA-05 | `POST /api/whatsapp/webhooks/whatsapp` | Unsupported event payload | safe no-op or handled error | P1 |
| WA-06 | `POST /api/whatsapp/inbound-events/:id/process` | Process queued inbound event | `200` | P1 |
| WA-07 | `POST /api/whatsapp/inbound-events/:id/process` | Missing event id | `404` | P1 |
| WA-08 | `POST /api/whatsapp/send` | Send outbound WhatsApp message successfully | `200` | P0 |
| WA-09 | `POST /api/whatsapp/send` | Missing phone/body/template data | `400` | P0 |
| WA-10 | `POST /api/whatsapp/send` | Provider failure from Meta/Twilio | safe error | P0 |
| WA-11 | `GET /api/whatsapp/test` | Connectivity test for active subscription merchant | `200` | P2 |
| WA-12 | `GET /webhooks/whatsapp` | Root alias verification path | same behavior as API path | P0 |
| WA-13 | `POST /webhooks/whatsapp` | Root alias inbound path | same behavior as API path | P0 |

## Messages

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| MSG-01 | `POST /api/messages/schedule` | Valid message schedule | `201/200` | P1 |
| MSG-02 | `POST /api/messages/schedule` | Invalid schedule payload | `400` | P1 |
| MSG-03 | `POST /api/messages/schedule-order` | Valid order-based schedule | `201/200` | P1 |
| MSG-04 | `POST /api/messages/schedule-order` | Unknown order or invalid timing | business error | P1 |
| MSG-05 | `POST /api/messages/cancel-order` | Cancel scheduled order messages | `200` | P1 |
| MSG-06 | `POST /api/messages/cancel-order` | No existing tasks to cancel | idempotent success | P1 |
| MSG-07 | `GET /api/messages/user/:userId` | Fetch user scheduled messages | `200` | P1 |
| MSG-08 | `GET /api/messages/user/:userId` | Foreign user scope | no cross-merchant leakage | P0 |

## Conversations

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| CONV-01 | `GET /api/conversations` | List merchant conversations | `200` | P1 |
| CONV-02 | `GET /api/conversations` | Filter/pagination query valid | `200` filtered result | P1 |
| CONV-03 | `GET /api/conversations/:id` | Existing conversation detail | `200` | P1 |
| CONV-04 | `GET /api/conversations/:id` | Foreign conversation | `404` | P0 |
| CONV-05 | `POST /api/conversations/:id/reply` | Valid reply | `200` and outbound message queued/sent | P1 |
| CONV-06 | `POST /api/conversations/:id/reply` | Reply to closed/invalid conversation | business error | P1 |
| CONV-07 | `PUT /api/conversations/:id/status` | Valid status transition | `200` | P1 |
| CONV-08 | `PUT /api/conversations/:id/status` | Invalid status value | `400` | P1 |

## Analytics

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| AN-01 | `GET /api/analytics/dashboard` | Dashboard metrics available | `200` | P1 |
| AN-02 | `GET /api/analytics/dashboard` | Empty merchant data | `200` zeroed aggregates | P1 |
| AN-03 | `GET /api/analytics/roi` | ROI metrics available | `200` | P1 |
| AN-04 | `GET /api/analytics/return-prevention` | Prevention analytics available | `200` | P1 |
| AN-05 | Analytics endpoints | Invalid date/query filters | `400` if validated, otherwise safe fallback | P1 |

## Customers

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| CUST-01 | `GET /api/customers` | List customers for merchant | `200` | P1 |
| CUST-02 | `GET /api/customers` | Empty customer list | `200` empty list | P1 |
| CUST-03 | `GET /api/customers/:id` | Existing customer detail | `200` | P1 |
| CUST-04 | `GET /api/customers/:id` | Foreign or missing customer | `404` | P0 |

## GDPR

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| GDPR-01 | `GET /api/gdpr/export` | Merchant export request | `200/202` with export job or payload | P1 |
| GDPR-02 | `GET /api/gdpr/exports` | List export jobs | `200` | P1 |
| GDPR-03 | `GET /api/gdpr/exports/:id` | Existing export job detail | `200` | P1 |
| GDPR-04 | `GET /api/gdpr/exports/:id` | Foreign export id | `404` | P0 |
| GDPR-05 | `POST /api/gdpr/jobs/:id/process` | Valid process call | `200` | P1 |
| GDPR-06 | `POST /api/gdpr/jobs/:id/process` | Missing job | `404` | P1 |
| GDPR-07 | `GET /api/gdpr/users/:userId/export` | Export specific user data | `200/202` | P1 |
| GDPR-08 | `DELETE /api/gdpr/delete` | Merchant deletion request with valid confirmation | `200/202` | P0 |
| GDPR-09 | `DELETE /api/gdpr/delete` | Missing confirmation or invalid payload | `400` | P0 |

## Billing

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| BILL-01 | `GET /api/billing/subscription` | Active subscription exists | `200` | P0 |
| BILL-02 | `GET /api/billing/subscription` | No active subscription | `200` with inactive/free state | P0 |
| BILL-03 | `GET /api/billing/usage` | Usage summary fetch | `200` | P1 |
| BILL-04 | `GET /api/billing/usage/history` | Usage history fetch | `200` | P1 |
| BILL-05 | `GET /api/billing/plans` | Plan catalog fetch | `200` | P1 |
| BILL-06 | `POST /api/billing/subscribe` | Subscribe to valid plan | `200` with checkout/activation result | P0 |
| BILL-07 | `POST /api/billing/subscribe` | Invalid plan key | `400` | P0 |
| BILL-08 | `POST /api/billing/subscribe` | Billing provider failure | safe error | P0 |
| BILL-09 | `POST /api/billing/cancel` | Cancel active subscription | `200` | P0 |
| BILL-10 | `POST /api/billing/cancel` | No active subscription to cancel | idempotent safe response | P1 |
| BILL-11 | `GET /api/billing/addons` | Add-on status list | `200` | P1 |
| BILL-12 | `POST /api/billing/addons/:key/subscribe` | Subscribe to valid add-on | `200` | P1 |
| BILL-13 | `POST /api/billing/addons/:key/subscribe` | Invalid add-on key | `404/400` | P1 |
| BILL-14 | `GET /api/billing/addons/:key/confirm` | Confirm add-on purchase | `200` | P1 |
| BILL-15 | `POST /api/billing/addons/:key/cancel` | Cancel add-on | `200` | P1 |

## Events

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| EVT-01 | `POST /api/events/process` | Process pending events batch | `200` | P1 |
| EVT-02 | `POST /api/events/process` | No pending events | `200` with zero processed | P1 |
| EVT-03 | `POST /api/events/:id/process` | Process specific event | `200` | P1 |
| EVT-04 | `POST /api/events/:id/process` | Missing event | `404` | P1 |
| EVT-05 | Event processing endpoints | Reprocessing already-processed event | idempotent or safe conflict response | P1 |

## Admin

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| ADM-01 | All `/api/admin/*` endpoints | Non-admin user attempts access | `403` | P0 |
| ADM-02 | `GET /api/admin/stats` | Admin stats fetch | `200` | P2 |
| ADM-03 | `GET /api/admin/merchants` | Merchant list fetch | `200` | P2 |
| ADM-04 | `GET /api/admin/merchants/:id/ai-usage` | AI usage for merchant | `200` | P2 |
| ADM-05 | `GET /api/admin/system-health` | Admin system health view | `200` | P2 |
| ADM-06 | `GET /api/admin/ai-settings` | AI settings fetch | `200` | P2 |
| ADM-07 | `PUT /api/admin/ai-settings` | Valid AI settings update | `200` | P2 |
| ADM-08 | `PUT /api/admin/ai-settings` | Invalid AI settings payload | `400` | P2 |
| ADM-09 | `POST /api/admin/impersonate` | Valid impersonation request | `200` with impersonation token/context | P1 |
| ADM-10 | `POST /api/admin/set-capped-amount` | Valid cap update | `200` | P2 |

## Commerce Webhooks

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| WEB-01 | `POST /webhooks/commerce/shopify` | Valid Shopify HMAC and payload | `200`, event stored/queued | P0 |
| WEB-02 | `POST /webhooks/commerce/shopify` | Invalid HMAC | `401` | P0 |
| WEB-03 | `POST /webhooks/commerce/shopify` | Missing required Shopify headers | `400` | P0 |
| WEB-04 | `POST /webhooks/commerce/shopify` | Unknown shop/integration | safe rejection | P0 |
| WEB-05 | `POST /webhooks/commerce/shopify` | Opt-out customer event | `200`, ignored without storing event | P0 |
| WEB-06 | `POST /webhooks/commerce/event` | Valid generic commerce event with API key/secret | `200` | P1 |
| WEB-07 | `POST /webhooks/commerce/event` | Missing auth secret/API key | `401/403` | P1 |
| WEB-08 | `POST /webhooks/commerce/event` | Malformed event payload | `400` | P1 |

## Shopify GDPR Webhooks

| ID | Endpoint | Scenario | Expected Result | Priority |
| --- | --- | --- | --- | --- |
| SGDPR-01 | `POST /api/webhooks/shopify/gdpr/customers/data_request` | Valid Shopify GDPR HMAC and payload | `200` | P0 |
| SGDPR-02 | `POST /api/webhooks/shopify/gdpr/customers/redact` | Valid redact webhook | `200` | P0 |
| SGDPR-03 | `POST /api/webhooks/shopify/gdpr/shop/redact` | Valid shop redact webhook | `200` | P0 |
| SGDPR-04 | All Shopify GDPR webhook endpoints | Invalid HMAC | `401/403` | P0 |
| SGDPR-05 | All Shopify GDPR webhook endpoints | Missing required fields in payload | `400` | P1 |

## Recommended Execution Order

1. Cover `P0` scenarios first in automated integration tests.
2. Add manual staging smoke coverage for Shopify OAuth, Shopify webhooks, WhatsApp webhooks, and outbound WhatsApp send.
3. Expand into `P1` merchant, analytics, GDPR, and admin coverage.
4. Add route-to-test coverage checks so every mounted endpoint maps to at least one scenario id.

## Notes

- Use shared fixtures for merchant, product, integration, conversation, webhook, and billing state.
- For provider-backed endpoints, keep most tests mocked in integration tests and add a thin staging smoke suite for real external systems.
- Treat tenant isolation tests as mandatory for every endpoint that reads or mutates merchant data.
