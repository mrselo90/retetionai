# Active Context

## Current Focus: Planning Super Admin Panel
- **Status**: All database migrations (including `013_notification_phone.sql`) applied and verified. Server deployment fully complete and stable. 
- **Next Step**: Designing and planning a "Super Admin" backoffice panel to manage merchants, billing, and platform health globally.

## Recent Accomplishments
- **Product Enrichment Assessment**: Verified and tested the product data enrichment process (LLM enrichment, worker flow, API endpoints). Best practices are followed (error handling, chunking, OpenAI usage limits). Added missing unit tests for `enrichProduct.ts`.
- **BFS Gap Closure**:
  - **G1**: `verify-session` now returns Supabase magic link for auto-login.
  - **G2**: `DashboardLayout` switches between side-nav (standalone) and `s-app-nav` (embedded).
  - **G3**: `ShopifySaveBar` implemented on Settings pages.
  - **G4**: `InlineError` replaces toasts on Settings pages (BFS requirement).
  - **G5**: `PlanGatedFeature` visually disables locked add-ons.
- **Landing Page**: Retained premium dark design (verified in previous session).

## Active Tasks (from task.md)
- [x] G1: Seamless Onboarding
- [x] G2: s-app-nav
- [x] G3: Contextual Save Bar
- [x] G4: Error UX
- [x] G5: Plan-Gated UI
- [ ] G6: Partner Dashboard Content (User Manual Task)

## Known Issues / Notes
- **Dev Store Testing**: Cannot be automated agent-side. User must verify the embedded flow on a real dev store.
- **Supabase Key**: `SUPABASE_SERVICE_ROLE_KEY` must be set on the production server for the G1 onboarding flow.
- **Database Migration**: `004_subscription_system.sql` must be manually executed by the user via Supabase SQL Editor due to droplet IPv6 connection limitations restricting automated deployment of the SQL functions.
