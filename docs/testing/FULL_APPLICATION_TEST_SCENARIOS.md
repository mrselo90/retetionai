# Full Application Test Scenarios

This is the master regression scenario list for the whole Recete application.

## Legend

- Priority: `P0` critical, `P1` high, `P2` medium
- Type: `API`, `E2E`, `Integration`, `Worker`, `Manual`

---

## 1) Authentication & Account

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| AUTH-001 | Sign up with valid merchant/user payload | Account and merchant are created | P0 | API |
| AUTH-002 | Login with valid credentials | Session/token returned | P0 | API |
| AUTH-003 | Login with wrong password | Unauthorized error | P0 | API |
| AUTH-004 | Password reset flow (request + reset) | User can set new password and login | P1 | E2E |
| AUTH-005 | Expired/invalid token on protected route | Request is rejected | P0 | API |

## 2) Merchant Workspace & Onboarding

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| MER-001 | Merchant profile fetch/update | Correct merchant-scoped data | P1 | API |
| MER-002 | Merchant settings persist | Updated settings reflected on reload | P1 | E2E |
| MER-003 | New merchant onboarding path | Required setup steps complete successfully | P1 | E2E |

## 3) Product Management

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| PROD-001 | Create/update/delete product | Product lifecycle works end-to-end | P0 | API |
| PROD-002 | Product mapping from Shopify source | Product is correctly mapped to local record | P0 | Integration |
| PROD-003 | Product instructions save/edit | Instructions persist and are retrievable | P0 | API |
| PROD-004 | Cross-merchant product access attempt | Forbidden/not found | P0 | API |

## 4) AI Knowledge Pipeline (Scrape/Enrich/Embeddings)

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| KNOW-001 | Scrape product URL successfully | `raw_text` and knowledge content generated | P0 | API |
| KNOW-002 | Enrich from extra URL | Enriched knowledge and chunks generated | P1 | API |
| KNOW-003 | Generate embeddings for product | Chunk count and embeddings created | P0 | API |
| KNOW-004 | Re-run pipeline on updated setup | Knowledge refreshed without corruption | P0 | Integration |
| KNOW-005 | Invalid/unreachable URL in pipeline | Safe validation error returned | P1 | API |

## 5) AI Answer Engine (RAG + Grounding)

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| AI-001 | Ask usage question with knowledge available | Grounded answer with product context | P0 | API |
| AI-002 | Ask question when knowledge missing | Safe fallback response | P1 | API |
| AI-003 | Order-scoped question | Retrieval narrows to order products | P0 | Integration |
| AI-004 | Follow-up question with conversation history | Context continuity preserved | P1 | Integration |

## 6) Multilingual Support

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| LANG-001 | Turkish question | Turkish response, proper intent classification | P0 | API |
| LANG-002 | English question | English response | P1 | API |
| LANG-003 | German question | German response | P1 | API |
| LANG-004 | Hungarian question | Hungarian response | P1 | API |
| LANG-005 | Unsupported language input | Fallback notice + supported-language response | P1 | API |

## 7) Guardrails & Safety

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| SAFE-001 | Unsafe/self-harm message | Guardrail blocks and safe response returned | P0 | API |
| SAFE-002 | Medical-risk advice request | Safe constrained response | P0 | API |
| SAFE-003 | Custom merchant guardrail trigger | Custom guardrail behavior applied | P1 | API |
| SAFE-004 | Human handoff request | Escalation flag and handoff response returned | P0 | API |

## 8) Return Prevention & Upsell

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| RET-001 | Return-intent message | Return prevention path is activated | P0 | API |
| RET-002 | Complaint that is not return request | Complaint flow without false return prevention | P1 | API |
| RET-003 | Positive follow-up after return-prevention attempt | Outcome is tracked as prevented | P1 | Integration |
| UPSELL-001 | Satisfaction checkpoint eligible | Upsell trigger applied correctly | P1 | Integration |

## 9) WhatsApp Messaging

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| WA-001 | Inbound webhook signature valid | Event accepted and processed | P0 | Integration |
| WA-002 | Inbound webhook signature invalid | Request rejected | P0 | API |
| WA-003 | Outbound send success (provider) | Message sent and logged | P0 | Integration |
| WA-004 | Provider failure during outbound send | Safe error and retry-safe behavior | P0 | Integration |
| WA-005 | Opt-out message from customer | Future outbound messaging is blocked per policy | P0 | Integration |

## 10) Shopify Integration

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| SHP-001 | OAuth auth start + callback | Integration becomes active | P0 | Integration |
| SHP-002 | Invalid OAuth state/HMAC | Callback rejected safely | P0 | API |
| SHP-003 | Embedded session verification | Valid Shopify session accepted | P0 | API |
| SHP-004 | Product sync fetch | Shopify products returned and usable | P1 | Integration |
| SHP-005 | App uninstalled webhook | Integration/session deactivated | P0 | Integration |

## 11) Order/Event Ingestion

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| EVT-001 | `order_created` normalized event | Order/user records are created/updated | P0 | Integration |
| EVT-002 | `order_delivered` normalized event | Delivery status updated and follow-up queued | P0 | Integration |
| EVT-003 | Duplicate event replay | Idempotent behavior (no duplicate corruption) | P0 | Integration |

## 12) Conversations Center

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| CONV-001 | Conversations list pagination/filter | Correct scoped list returned | P1 | API |
| CONV-002 | Conversation detail with messages | Full timeline visible | P1 | E2E |
| CONV-003 | Manual agent reply from dashboard | Reply is sent and persisted | P1 | E2E |
| CONV-004 | Update conversation status | Status change persists | P1 | API |

## 13) Customer 360

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| CUST-001 | Customers list fetch | Merchant-scoped customer list | P1 | API |
| CUST-002 | Customer detail page | Customer orders/conversations render correctly | P1 | E2E |
| CUST-003 | Cross-tenant customer access | Rejected | P0 | API |

## 14) Scheduled Messaging & Automation

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| MSG-001 | Schedule message by order | Job is queued with expected schedule | P1 | API |
| MSG-002 | Cancel scheduled messages for order | Active scheduled jobs canceled | P1 | API |
| MSG-003 | Worker executes due message job | Message sent and job marked complete | P0 | Worker |
| MSG-004 | Worker retry path on provider failure | Retry/backoff semantics applied | P0 | Worker |

## 15) Analytics & ROI

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| AN-001 | Dashboard analytics endpoint | Correct aggregate metrics returned | P1 | API |
| AN-002 | ROI endpoint with baseline data | ROI values computed correctly | P1 | API |
| AN-003 | Return-prevention analytics | Prevention metrics visible and consistent | P1 | API |

## 16) Billing, Plans, Limits

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| BILL-001 | Subscribe/activate plan | Merchant subscription status becomes active | P0 | Integration |
| BILL-002 | Cancel subscription | Subscription status updated correctly | P1 | Integration |
| BILL-003 | Plan-limited feature access | Restricted feature is blocked with proper message | P0 | Integration |
| BILL-004 | Usage tracking increments | Usage counters/events recorded accurately | P0 | Integration |
| BILL-005 | Add-on activation/deactivation | Add-on capability toggles correctly | P1 | API |

## 17) Team Member Management

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| TEAM-001 | Invite member | Invite/member record created | P1 | API |
| TEAM-002 | Update role | Role changes persist with authorization checks | P1 | API |
| TEAM-003 | Remove member | Member access revoked | P1 | API |

## 18) GDPR & Data Governance

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| GDPR-001 | Merchant data export request | Export job/payload is generated | P1 | API |
| GDPR-002 | User-specific export | Target user data exported correctly | P1 | API |
| GDPR-003 | Merchant deletion request | Data deletion workflow starts safely | P0 | Integration |
| GDPR-004 | Access foreign GDPR job ID | Rejected | P0 | API |

## 19) API Key Management

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| KEY-001 | Create API key | New key generated and hash stored | P1 | API |
| KEY-002 | Rotate API key | Old key revoked and new key active | P1 | API |
| KEY-003 | Revoke API key | Revoked key cannot authenticate | P1 | API |
| KEY-004 | Expired API key cleanup job | Expired keys disabled by scheduler | P2 | Worker |

## 20) Super Admin

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| ADM-001 | Super-admin access guard | Non-admin users cannot access admin APIs/pages | P0 | API/E2E |
| ADM-002 | Global stats endpoint | Platform totals returned | P1 | API |
| ADM-003 | Merchant test-kit order creation | Test order is created and can be delivered | P1 | API |
| ADM-004 | Simulate inbound WhatsApp reply | AI response generated through real flow | P1 | API |
| ADM-005 | Run Shopify scenario suite | Pass/fail summary and assertions returned | P0 | API/E2E |
| ADM-006 | System health endpoint | Redis/queue/system health is reported | P1 | API |

## 21) Workers & Queues

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| WRK-001 | Queue enqueue/dequeue sanity | Jobs are consumed by expected workers | P0 | Worker |
| WRK-002 | Scrape job worker pipeline | Scrape -> enrich -> embeddings chain completes | P0 | Worker |
| WRK-003 | Intelligence workers (RFM/churn/recommendations) | Jobs run and persist outputs | P2 | Worker |
| WRK-004 | Worker restart/resume behavior | In-flight jobs recover safely | P1 | Worker |

## 22) Observability, Security & Reliability

| ID | Scenario | Expected Result | Priority | Type |
| --- | --- | --- | --- | --- |
| OBS-001 | `GET /health` all dependencies healthy | Healthy response with service indicators | P0 | API |
| OBS-002 | Rate limit exceeded | `429` with no crash | P1 | API |
| OBS-003 | Security headers present on responses | Required headers included | P1 | API |
| OBS-004 | Error path logs and monitoring hooks | Errors are captured without leaking secrets | P1 | Integration |

---

## Execution Strategy

1. `P0` scenarios on every release candidate.
2. `P1` scenarios daily on staging + before major deploy.
3. `P2` scenarios in weekly regression cycle.

## Existing Related Docs

- `docs/testing/API_TEST_SCENARIOS.md`
- `docs/testing/SHOPIFY_SUPERADMIN_SCENARIOS.md`
