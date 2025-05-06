# Notion Lifeline - Client-Side TODO List

This list tracks the remaining frontend tasks to finalize the MVP and add polish, based on `ui.md`, `IMPLEMENTATION_PLAN.md`, and `PRD.MD`.

**Status Key:**
*   `[ ]` To Do
*   `[🟡]` Client-side implemented, needs backend integration/verification.
*   `[✅]` Client-side implementation complete.
*   `[~]` Assumed/Deferred.

---

## 🟢 Client-Side Launch Blockers (Priority Tasks)

These tasks directly correspond to the 5 launch blockers identified in `IMPLEMENTATION_PLAN.md`.

**1. Snapshot List API + Dashboard Table Connection:**
- [~] **Clarify API Response:** Assumed API returns `Snapshot[]` structure for now.
- [ ] **Update Type/UI (If Needed):** Deferred pending API response confirmation.
- [🟡] **Verify SWR Fetch:** SWR hook, loading, error, empty states implemented in `SnapshotsTable.tsx`. Needs testing against live `/api/snapshots` endpoint.
- [✅] **Make "Create Snapshot" FAB Functional:** `onClick` handler calls `POST /api/snapshots/create`, shows loading/toast, uses SWR `mutate` (Implemented in `app/page.tsx`). Needs testing against live API.

**2. Restore Wizard UI & Success Path:**
- [🟡] **Verify Restore API Call:** `handleBeginRestore` calls `POST /api/restore` with data, handles success/error toasts (Implemented in `RestoreWizard.tsx`). Needs testing against live API.
- [✅] **Implement Real-time Progress (SSE):** Progress bar UI and simulation logic implemented in `RestoreWizard.tsx`. Needs replacement with `EventSource` connection to live SSE endpoint.

**3. Notion OAuth Flow:**
- [ ] **Clarify Backend Status:** Confirm backend API routes (`/api/auth/notion/start`, `/api/auth/notion/callback`) are implemented.
- [✅] **Implement Frontend Trigger:** "Connect Notion" button in `SettingsPage.tsx` redirects to `/api/auth/notion/start`.
- [✅] **Fetch & Display Real Connection Status:** Modify `SettingsPage.tsx` to fetch and display actual Notion connection status via SWR or similar.

**4. Stripe Checkout & Quota Enforcement:**
- [ ] **Confirm API Endpoint Name:** Verify/update `fetch` call URL in `UpgradeModal.tsx` (`/api/subscribe` vs `/api/stripe/...`).
- [ ] **Add Stripe Publishable Key:** User Task: Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local`.
- [🟡] **Verify Checkout Flow:** "Choose Plan" buttons in `UpgradeModal.tsx` call backend API and use Stripe.js `redirectToCheckout`. Needs testing against live API.
- [ ] **Fetch Real Quota/Plan Data:** Modify `Sidebar.tsx` to fetch and display user's current plan/usage via SWR.
- [✅] **Implement Quota Enforcement UI:** FAB in `app/page.tsx` is disabled and shows tooltip based on mock quota data.

**5. Basic Monitoring (Sentry Client-Side):**
- [ ] **Initialize Sentry:** User Task: Run `npx @sentry/wizard@latest -i nextjs` and configure DSN.
- [🟡] **Verify Error Reporting:** `<ErrorBoundary>` implemented and wrapped around layout. Needs testing after Sentry initialization.

---

## 🟡 Instrumentation & Polish (Lower Priority for MVP)

- [ ] **Implement PostHog:**
    - [✅] Install `posthog-js`.
    - [✅] Initialize PostHog (in `app/layout.tsx` via `PostHogProvider.tsx`) with API key/host.
    - [✅] Implement user identification (`posthog.identify`).
    - [✅] Add custom `posthog.capture()` events for snapshot/restore/plan actions.
- [ ] **Implement Onboarding Tour:**
    - [✅] Choose and install a library (`react-joyride`).
    - [✅] Define tour steps targeting key UI elements (`OnboardingTour.tsx`).
    - [✅] Implement logic to trigger tour for new users and track completion (using localStorage for now).
- [ ] **UI Polish:**
    - [✅] Refine empty state components (Created `EmptyState.tsx`, used in `SnapshotsTable.tsx`).
    - [🟡] Review/enhance loading indicators (FAB, Modals improved; Settings page pending).
    - [ ] Improve user feedback messages (toasts, errors).
    - [✅] Add animations (Framer Motion added to dialogs).

---

## 🔴 Backend API Dependencies Checklist (for Frontend)

Confirm implementation and exact specs for:

- [🟡] `GET /api/snapshots` (Response structure?) - *Placeholder created*
- [🟡] `POST /api/snapshots/create` - *Placeholder created*
- [🟡] `POST /api/restore` - *Placeholder created*
- [ ] `GET /api/restore-status?id=...` (SSE endpoint)
- [🟡] `GET /api/auth/notion/start` (or similar) - *Placeholder created*
- [🟡] `GET /api/auth/notion/callback` - *Placeholder created*
- [🟡] `DELETE /api/auth/notion` - *Placeholder created*
- [🟡] `POST /api/stripe/create-checkout-session` (or `/api/subscribe`) - *Placeholder created*
- [🟡] `POST /api/stripe/webhook` - *Placeholder created*
- [🟡] `GET /api/user/settings` - *Placeholder created*
- [🟡] `POST /api/user/settings` - *Placeholder created*
- [🟡] `GET /api/user/quota` - *Placeholder created*
- [🟡] `POST /api/user/api-key/regenerate` - *Placeholder created* 