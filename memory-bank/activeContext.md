# Active Context

## Current Focus: Post-Deployment Stability & Store Submission Prep
- **Status**: Code-complete for BFS gaps G1-G5, deployed to production. Repo pushed to git (5a3fc22).
- **Last Action**: Ran server deploy via SSH: pull, build, pm2 restart all (api, web, workers online). Migration step skipped (Supabase unreachable from server IPv6).
- **Next Step**: Manually run `004_subscription_system.sql` in Supabase if not done; handle G6 (Partner Dashboard content).

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
- **Supabase Key**: `SUPABASE_SERVICE_ROLE_KEY` must be set on the production server for the G1 onboarding flow.
- **Database Migration**: `004_subscription_system.sql` must be manually executed by the user via Supabase SQL Editor due to droplet IPv6 connection limitations restricting automated deployment of the SQL functions.
