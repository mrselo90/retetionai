# Active Context

## Current Focus: Shopify App Store Submission Prep
- **Status**: Code-complete for BFS gaps G1-G5.
- **Last Action**: Implemented and verified seamless onboarding, s-app-nav, save bar, error UX, and plan-gated UI.
- **Next Step**: User to handle G6 (Partner Dashboard content) and deployment.

## Recent Accomplishments
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
- **Supabase Key**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on the production server for the new G1 onboarding flow to work.
