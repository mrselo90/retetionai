# Active Context

## Current Focus: Cosmetics RAG Reliability + Eval Quality
- **Status**: API-key-free internal auth path is live (`INTERNAL_SERVICE_SECRET`), Maruderm HU test products ingested (10 products, chunked), and products dashboard chunk-status false negatives fixed.
- **Next Step**: Improve multilingual (TR/EN/HU) eval quality with proper product scoping, stronger facts-first usage, and better grounding.

## Recent Accomplishments
- **Merchant API Key Removal (Active Paths)**:
  - Merchant API key auth removed from runtime auth middleware and admin UI flows
  - Internal service auth (`X-Internal-Secret`) added for worker/eval/debug routes
  - Shopify app keys remain (Shopify requirements only)
- **Maruderm Test Dataset Ingestion**:
  - 10 real products from `maruderm.hu` ingested into test merchant
  - scrape + enrich + embedding pipeline validated end-to-end (chunks created)
- **Products Dashboard RAG Status Fix**:
  - `chunks/batch` parse error no longer causes false `0 chunk`
  - UI shows unknown state instead of false `RAG not ready` when chunk-count fetch fails
- **Landing Page Responsive Cleanup**:
  - Mobile-first spacing rhythm tightened across sections (Hero→Stats, Features, How It Works, Social Proof, Pricing, FAQ, CTA, Footer)
  - Alignment inconsistencies fixed (card heights, section headers, mobile CTA/button layout, footer grid spacing)
- **Manual RAG Test UX (Dashboard / Test)**:
  - Advanced RAG tab now loads existing merchant products and chunk counts for direct selection
  - Supports search/filter and multi-select so manual RAG questions can be scoped to specific scraped products (avoids all-products ambiguity)
  - Auth middleware updated to prefer JWT/Shopify token over internal secret, preventing browser requests from failing on stray `X-Internal-Secret` headers
- **Products Page View Modes**:
  - Added Shopify-style `Grid / List` toggle to Products dashboard
  - List view is mobile-first (stacked rows on small screens, table-like columns on desktop) and preserves existing RAG status badges/actions
  - Added Shopify-like product index controls: search, status filter, sort, result count, and reset filters (shared across grid/list views)
  - Follow-up runtime fixes: moved `useDeferredValue` above conditional returns (React hook order) and fixed dashboard summary rich-text translation formatting for Polaris subtitle
  - Filter toolbar alignment refined: search/status/sort fields now share the same label/control rhythm and responsive grid alignment
  - Polaris migration (step 1): Products filter toolbar now uses Polaris `TextField` + `Select` controls, moving the page closer to Shopify-native form behavior
  - Polaris migration (step 2): Desktop list view now uses Polaris `IndexTable` while keeping mobile stacked rows for mobile-first usability
  - Products index (step 3): Added applied filter chips and bulk product actions (select visible/clear selection/re-scrape/generate embeddings) aligned with RAG operations workflow
  - Products index (step 4): Bulk actions now use batch endpoints (`scrape-batch`, `generate-embeddings-batch`) and saved views/tabs (local persisted presets) were added for Shopify-like workflow
- **Dashboard Polaris-first Standardization (step 1)**:
  - Replaced remaining ad-hoc icon tiles/row icon shells with Polaris `Box`-based surfaces to align visual tokens/backgrounds with Shopify Polaris
  - Preserved existing dashboard information architecture while reducing custom Tailwind visual primitives
- **Conversations Polaris Migration (step 1)**:
  - Desktop conversations list migrated to Polaris `IndexTable` (mobile-first stacked rows retained)
  - Empty state and row icon surfaces moved toward Polaris `Box` primitives; table columns localized via `Conversations.table.columns`
- **Conversations Polaris Migration (step 2)**:
  - Sentiment and status filters migrated from custom button rows to Polaris `Tabs` (two-tab-bar filter layout)
  - Mobile horizontal-scroll hacks removed in favor of Polaris tab disclosure behavior
- **Conversations Polaris Migration (step 3)**:
  - Mobile conversation rows refactored to Polaris layout primitives (`Box`, `InlineStack`, `BlockStack`, `Text`) to reduce Tailwind-specific row composition
  - Removed placeholder header spacer from Conversations page structure
- **Conversation Detail Polaris Migration (step 1)**:
  - Header, message history wrapper, reply composer, and stats cards refactored to Polaris-first primitives (`Card`, `Box`, `InlineGrid`, `InlineStack`, `BlockStack`, `TextField`, `Badge`)
  - Preserved functional behavior (reply send, status toggles, polling) while removing a large share of custom Tailwind layout shells
- **Product Detail Polaris Migration (step 1)**:
  - `/dashboard/products/[id]` refactored to Polaris-first layout for product info, bot instructions, scraped content, return-prevention fields, and metadata sections
  - Custom `input/textarea/card` Tailwind shells replaced with Polaris `Card`, `Box`, `BlockStack`, `InlineGrid`, `InlineStack`, `TextField`, and `Badge`
  - Existing local behavior preserved (save, re-scrape, generate embeddings, instruction warning toast)
- **Test Page Polaris Migration (step 1)**:
  - `Dashboard / Test` header and step indicator refactored to Polaris layout primitives (`Box`, `BlockStack`, `InlineGrid`, `InlineStack`) while preserving mobile-first behavior
  - Advanced section tabs migrated from custom button row to Polaris `Tabs`
  - Core test flows (order create / delivery trigger / chat / RAG test tools) preserved for further incremental migration
- **Settings Polaris Migration (step 1)**:
  - Header and loading skeleton surfaces moved to Polaris card/box primitives
  - Notification settings card migrated to Polaris-first (`Polaris Card`, `TextField`)
  - Bot Persona top controls migrated to Polaris controls (`TextField`, `ChoiceList`, `Checkbox`, `RangeSlider`) while preserving save flow and embedded `ShopifySaveBar`
  - Product scope / WhatsApp sender option blocks now use Polaris choice controls with helper summaries and banners
- **Settings Polaris Migration (step 2)**:
  - `Modules`, `Guardrails`, and `GDPR` sections migrated to Polaris-first outer containers/headers (`Polaris Card`, `Box`, `BlockStack`, `InlineStack`)
  - Existing business logic/actions preserved (add-on toggle dialog, guardrail CRUD actions, GDPR export/delete actions)
  - Inner list rows still partially custom/Tailwind and can be standardized further in later passes
- **Web Deploy Sync (latest Polaris changes)**:
  - Latest web build deployed to server (`root@209.97.134.215`) and PM2 `web` process restarted successfully
  - `api`, `web`, and `workers` all confirmed `online` after restart
- **Product Enrichment Assessment**: Verified and tested the product data enrichment process (LLM enrichment, worker flow, API endpoints). Best practices are followed (error handling, chunking, OpenAI usage limits). Added missing unit tests for `enrichProduct.ts`.
- **BFS Gap Closure**:
  - **G1**: `verify-session` now returns Supabase magic link for auto-login.
  - **G2**: `DashboardLayout` switches between side-nav (standalone) and `s-app-nav` (embedded).
  - **G3**: `ShopifySaveBar` implemented on Settings pages.
  - **G4**: `InlineError` replaces toasts on Settings pages (BFS requirement).
  - **G5**: `PlanGatedFeature` visually disables locked add-ons.

## Active Tasks (current)
- [x] Remove merchant API key dependency from active app/runtime paths
- [x] Add internal-secret auth for worker/eval/debug flows
- [x] Ingest Maruderm HU test products (10) and generate chunks
- [x] Fix false `RAG not ready` state in Products dashboard
- [ ] Re-run product-scoped multilingual cosmetics evals and tune results
- [ ] Align prod DB migrations for `product_facts` / chunk metadata

## Known Issues / Notes
- **Eval quality is currently sensitive to product scoping**: passing too many products at once (e.g. 10) degrades grounding and can inflate hallucination/wrong-product rates.
- **Prod schema drift observed**: `product_facts` query checks showed column mismatch (`extraction_status` missing in prod), so latest migrations should be verified/applied before relying on facts-first metrics.
- **Dev Store Testing**: Shopify embedded/dev-store verification still requires manual user testing.
