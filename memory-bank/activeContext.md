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
