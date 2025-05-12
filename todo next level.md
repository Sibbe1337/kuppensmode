Okay, let's break down each L-level epic into a more granular to-do list. This will give us a comprehensive overview. Keep in mind that for each "Task," there could be several sub-tasks or even separate stories depending on the complexity discovered during implementation.

Here's the breakdown:

---

**Epic L1: AI-powered "Smart Snapshot" & semantic diff engine**
*Goal: Give users ChatGPT-style answers about what changed in their workspace.*

*   **Phase 1: Core Embedding & Storage** (✅ **COMPLETED**)
    *   **L1.1: Setup Vector Database (Pinecone)**
        *   Task: Create/configure Pinecone account and index. (✅ **Done**)
        *   Task: Securely store Pinecone API key and environment details. (✅ **Done** - Vercel env vars `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `OPENAI_API_KEY` assumed set)
    *   **L1.2: Integrate Embedding Generation in Snapshot Worker (`snapshot-worker/index.ts`)**
        *   Task: Add `@langchain/openai` (or direct OpenAI SDK) and Pinecone client SDK to `snapshot-worker/package.json`. (✅ **Done**)
        *   Task: Modify worker to initialize OpenAI and Pinecone clients using stored API keys. (✅ **Done** - Includes lazy init for build and uses correct env var names)
        *   Task: For each significant text block within a page/database row encountered during snapshot:
            *   Generate a text embedding using an OpenAI model (e.g., `text-embedding-3-small`). (✅ **Done**)
            *   Consider data chunking strategies for large blocks to fit embedding model context windows and improve relevance. (✅ **Done** - `MAX_CHUNK_TOKENS`, overlap implemented)
        *   Task: Upsert embeddings to the Pinecone index, including metadata: `vector`, `original_text_snippet`, `pageId`, `blockId` (if applicable), `userId`, `snapshotId`. Ensure namespacing by `userId` in Pinecone. (✅ **Done** - Namespacing by `userId` implemented)
    *   **L1.3: Basic Diff Data Structure**
        *   Task: Define Firestore structure for storing a basic diff summary (if not using M4's `diffSummary` directly for this, or if more detail is needed). (✅ **Done** - `diff-worker` stores `SemanticDiffResult` in Firestore)

*   **Phase 2: Semantic Diff API & Basic UI** (✅ **Largely Done**)
    *   **L1.4: Semantic Diff API (`/api/diff/*` routes & `diff-worker`)** (✅ **Done**)
        *   Task: Create API endpoints: (✅ **Done**)
            *   `/api/diff/run`: to queue a diff job (payload: `snapshotIdFrom`, `snapshotIdTo`). Publishes to Pub/Sub.
            *   `/api/diff/status/[jobId]`: to poll job status from Firestore.
            *   `/api/diff/results/[jobId]`: to fetch detailed `SemanticDiffResult` from Firestore.
        *   Task: `diff-worker` logic: (✅ **Done**)
            *   Consumes job from Pub/Sub.
            *   Fetches hash manifests (from M4 - richer `HashManifestEntry` used).
            *   Identifies added/deleted/potentially changed items based on hash comparison.
            *   For potentially changed items, queries Pinecone for their embeddings from both snapshots (uses title, desc, or averaged chunks based on type and `totalChunks` from manifest).
            *   Performs vector similarity comparisons (cosine similarity implemented).
            *   Generates and stores `SemanticDiffResult` (summary & details) in Firestore.
    *   **L1.5: Basic Semantic Diff UI (New component in dashboard or snapshot details view)**
        *   Task: Frontend UI to select two snapshots for comparison. (✅ **Done** - `ComparisonEngineBar.tsx` has selectors).
        *   Task: Call `/api/diff/run`, poll status, fetch results, and display summary counts. (✅ **Done** - `ComparisonEngineBar.tsx` implements this. Display labels refined.)
        *   Task: UI to display detailed semantic diff results (from `SemanticDiffResult.details`). (✅ **Done** - `app/(app)/comparison/[jobId]/page.tsx` displays results, including change type tooltips).

*   **Phase 3: LLM-Powered Analysis & Chat Interface** (✅ **COMPLETED**)
    *   **L1.6: Enhance Semantic Diff API for LLM Analysis** (✅ **Done**)
        *   Task: Modify `/api/diff/semantic` (logic moved to `diff-worker`) to take the structured summary and relevant text snippets of changed items. (✅ Done - Worker uses its computed diff)
        *   Task: Construct a detailed prompt for an LLM (e.g., GPT-4) to generate a natural language summary of the changes. (✅ Done - Implemented in `diff-worker/src/openaiUtils.ts`)
        *   Task: Return this LLM-generated summary. (✅ Done - Stored in `SemanticDiffResult.llmSummary` by `diff-worker`)
    *   **L1.7: UI for Natural Language Summary** (✅ **Done**)
        *   Task: Display the LLM-generated natural language summary in the diff UI. (✅ Done - Displayed in `Alert` on `app/(app)/comparison/[jobId]/page.tsx`, PostHog event added)
    *   **L1.8: "Ask a Question" Chat API (`/api/ai/ask-diff/route.ts` - enhance or new)**
        *   Task: API endpoint accepts `snapshotIdFrom`, `snapshotIdTo`, `userId`, and a natural language `question`. (✅ **Done** - `app/api/ai/ask-diff/route.ts` created and accepts these)
        *   Task: Backend logic: (✅ **Done** - Initial implementation in place)
            *   Use the question to perform a semantic search (vector query) against the embeddings of the *content* within the diff range (from `snapshotIdFrom` to `snapshotIdTo`). (✅ Done - Queries Pinecone using question embedding, filters by snapshot IDs)
            *   Retrieve relevant text chunks/embeddings. (✅ Done - Retrieves text from Pinecone match metadata)
            *   Construct a prompt for an LLM including the user's question and the retrieved context. (✅ Done)
            *   Return the LLM's answer. (✅ Done)
    *   **L1.9: Chat UI for Diff Analysis** (✅ **Done**)
        *   Task: Implement a chat interface where users can ask questions about the changes between two snapshots. (✅ **Done** - `DiffChatAssistant.tsx` component created)
        *   Task: UI to call the "Ask a Question" API and display responses. (✅ **Done** - Integrated into `comparison/[jobId]/page.tsx`)

---

**Epic L2: Cross-provider redundancy (GCS + S3 + R2)**
*Goal: Paid plans can replicate snapshots to the customer's cloud – zero vendor lock-in.*

*   **L2.1: Define `StorageAdapter` Interface**
    *   Task: Define a TypeScript interface `StorageAdapter` with methods like `write(path, data, metadata)`, `read(path)`, `list(pathPrefix)`, `delete(path)`, `exists(path)`. (✅ **Done** - Interface defined and used by GCS, S3, R2 adapters)
*   **L2.2: Implement GCS Adapter (`GCSStorageAdapter.ts`)**
    *   Task: Refactor existing GCS logic in `snapshot-worker` (and potentially restore worker) to use the `StorageAdapter` interface, implemented by a `GCSStorageAdapter` class. (✅ **Done** - Pre-existing, confirmed functional)
*   **L2.3: Implement AWS S3 Adapter (`S3StorageAdapter.ts`)**
    *   Task: Add AWS SDK for S3 to relevant worker(s). (✅ **Done**)
    *   Task: Create `S3StorageAdapter` class implementing `StorageAdapter`. (✅ **Done** - `S3StorageAdapter.ts` and `testS3Adapter.ts` created and tested)
    *   Task: Handle AWS credentials securely. (✅ **Done** - Adapter supports env vars/profile, and explicit credentials via constructor options after refactor)
*   **L2.4: Implement Cloudflare R2 Adapter (`R2StorageAdapter.ts`)**
    *   Task: Add Cloudflare R2 SDK (or S3-compatible SDK if R2 supports it well) to worker(s). (✅ **Done** - S3 SDK used)
    *   Task: Create `R2StorageAdapter` class. (✅ **Done** - `R2StorageAdapter.ts` and `testR2Adapter.ts` created and tested)
    *   Task: Handle R2 credentials. (✅ **Done** - Adapter takes explicit credentials)
    *   Task: Integrate R2 adapter in main app validation flow. (✅ **Done** - Used in `/api/user/storage-configs/[id]/validate/route.ts`)
    *   Task: Comprehensive test script covers all core and helper methods (write, read, list, delete, getMetadata, copy). (✅ **Done**)
    *   Status: R2 adapter is fully implemented, tested, and production-ready.
*   **L2.5: User Configuration for Replication** (➡️ **Nearing Completion - UI/API Implemented, Debugging API 500 Error**)
    *   Task: API to save these configurations securely (e.g., encrypted in Firestore). (✅ **Done** - API routes for CRUD and validation created using KMS for encryption; Firestore rules updated. Currently debugging a 500 error on POST.)
    *   Task: UI in user settings/billing for paid plans to configure external storage providers (S3/R2 endpoint, bucket, credentials). (✅ **Done** - SWR hook, page, list, and modal components implemented with initial styling. Awaiting successful API interaction for full test.)
*   **L2.6: Modify Snapshot Worker for Parallel Writes**
    *   Task: Update `snapshot-worker` to:
        *   Check user's plan and replication settings.
        *   If replication is configured, instantiate the appropriate `StorageAdapter`(s) alongside the 
        primary GCS adapter.
        *   Perform writes in parallel (or sequentially with robust error handling) to all configured storage locations.
        *   Log success/failure for each location.
*   **L2.7: Background Reconciler/Verifier (New Cloud Function or Cron Job)**
    *   Task: Design a process to periodically verify checksums/parity of replicated snapshots.
    *   Task: Implement the reconciler to:
        *   List snapshots in primary storage.
        *   For each, check existence and integrity (e.g., hash of metadata or a stored content hash) in replicated locations.
        *   Log discrepancies or trigger repair/retry mechanisms.
*   **L2.8: Update Restore Logic**
    *   Task: Restore logic needs to be aware of potential multiple storage locations, possibly allowing user to choose source or having a priority list. (This part might be simpler if primary is always GCS and others are just backups).

---

**Epic L3: Desktop tray app for "panic button" restore**
*Goal: Non-technical users click an OS-level icon to restore the latest good snapshot.*

*   **L3.1: Electron App Setup & Basic Structure**
    *   Task: Set up a new Electron project.
    *   Task: Implement basic main process and renderer process structure.
    *   Task: Design tray icon and menu.
*   **L3.2: Authentication (OAuth with Clerk)**
    *   Task: Implement Clerk OAuth flow within Electron to securely authenticate the user and obtain an access token.
    *   Task: Securely store and manage the access token (e.g., using OS keychain).
*   **L3.3: API Interaction**
    *   Task: Create a new API endpoint `/api/restore/latest-good` (or similar) that:
        *   Identifies the "latest good" snapshot for the authenticated user (requires definition of "good" - e.g., completed status, possibly based on diffs if L1 is advanced).
        *   Initiates a restore of this snapshot with default targets (e.g., restore to a new page).
    *   Task: Electron app to call this API endpoint using the obtained access token.
*   **L3.4: UI/UX in Desktop App**
    *   Task: Minimal UI for status (e.g., "Restoring...", "Restore complete").
    *   Task: Display system notifications (toasts) for success/failure.
    *   Task: On success, provide a link to open the newly restored Notion page (requires restore API to return the URL).
*   **L3.5: Auto-Updater**
    *   Task: Integrate `electron-updater`.
    *   Task: Configure update server (e.g., S3, GitHub Releases).
*   **L3.6: CI/CD for Desktop App Builds**
    *   Task: Set up CI pipeline (e.g., GitHub Actions) to:
        *   Build Electron app for macOS and Windows.
        *   Code sign the builds.
        *   Publish releases (e.g., to S3 or GitHub Releases).
        *   Update the auto-update feed.

---

**Epic L4: Enterprise SSO, SCIM & granular RBAC**
*Goal: Unlock $10 K+ contracts that require Okta/Azure AD integration.*

*   **L4.1: Configure Clerk for SSO**
    *   Task: Enable and configure SAML and OIDC SSO options in Clerk dashboard for enterprise customers.
    *   Task: Document setup process for customers (how to configure their IdP with Clerk).
*   **L4.2: SCIM Provisioning Endpoint (`/api/scim/v2/*` - new set of routes)**
    *   Task: Research SCIM protocol and Clerk's capabilities/recommendations for SCIM.
    *   Task: Implement SCIM server endpoints (Users, Groups if needed) under `/api/scim/v2/`.
        *   `GET /Users`, `POST /Users`, `GET /Users/{id}`, `PUT /Users/{id}`, `PATCH /Users/{id}`, `DELETE /Users/{id}`.
    *   Task: Logic to map SCIM user attributes to Clerk user attributes and application roles.
    *   Task: Secure these endpoints (e.g., bearer token authentication for SCIM client).
*   **L4.3: Define Role Model & Permissions**
    *   Task: Finalize roles: `OWNER`, `ADMIN`, `ANALYST`, `VIEWER` (or as needed).
    *   Task: Define specific permissions for each role (e.g., who can create snapshots, restore, manage billing, assign roles, view audit logs).
*   **L4.4: Enforce RBAC**
    *   Task: Store user roles (e.g., in Clerk custom user metadata, or Firestore `users/{uid}/roles`).
    *   Task: Middleware (e.g., Next.js middleware or per-API route checks) to enforce role-based access to API endpoints.
    *   Task: Update Firestore security rules to reflect RBAC for direct data access if any.
    *   Task: Frontend UI to conditionally render features/actions based on user's role.
*   **L4.5: Admin UI for Role Management**
    *   Task: New UI section/tab in the dashboard for `OWNER`s/`ADMIN`s.
    *   Task: Display list of users within their organization (if organizations are a concept, possibly via Clerk Organizations).
    *   Task: UI to assign/revoke roles to users.
    *   Task: API endpoints to support these role management actions.
*   **L4.6: Audit Logging for RBAC Changes**
    *   Task: Extend M6 audit logging to include role assignments/changes.

---

**Epic L5: SOC 2 Type II automation**
*Goal: Reduce sales friction; necessary for mid-market.*

*   **L5.1: Compliance Automation Platform Integration (Vanta/Secureframe)**
    *   Task: Select and onboard with a compliance automation platform.
    *   Task: Integrate platform's agent/webhook for evidence collection (e.g., monitoring cloud configurations, code repositories, HR systems).
*   **L5.2: Infrastructure as Code (Terraform)**
    *   Task: Define and implement Terraform (or other IaC tool like Pulumi) for all core infrastructure (GCP services like Cloud Functions, Pub/Sub, Scheduler, Storage; Vercel project settings; Cloudflare settings).
    *   Task: CI/CD pipeline for IaC changes, with review and approval processes.
*   **L5.3: Centralized Logging & Monitoring**
    *   Task: Ensure all application logs (frontend, backend APIs, workers) and infrastructure logs are centralized (e.g., Google Cloud Logging, then exported to BigQuery or a SIEM).
    *   Task: Define Key Performance Indicators (KPIs) and Service Level Objectives (SLOs) for critical functions (e.g., snapshot success rate, restore time, API uptime).
    *   Task: Set up monitoring and alerting for SLO breaches and security events (e.g., using Google Cloud Monitoring, Sentry, or SIEM alerts).
*   **L5.4: Document Controls & Policies**
    *   Task: Develop and document all necessary security policies and procedures (e.g., access control, change management, incident response, data backup/recovery, vendor management). This is largely a documentation effort, supported by the automation platform.
*   **L5.5: Evidence Collection Automation**
    *   Task: Create cron jobs or event-driven functions where necessary to periodically collect evidence not automatically gathered by the compliance platform (e.g., screenshots of configurations, reports from specific services).
    *   Task: Store collected evidence securely and make it accessible for audits.
*   **L5.6: Penetration Testing & Vulnerability Management**
    *   Task: Schedule and conduct regular penetration tests by third parties.
    *   Task: Implement a vulnerability scanning and management process for code and infrastructure.
*   **L5.7: Employee Training & Awareness**
    *   Task: Implement security awareness training for all employees.
*   **L5.8: Audit Support**
    *   Task: Prepare for and support the SOC 2 Type II audit process with auditors.

---

**Epic L6: In-app interactive onboarding tour + sandbox demo workspace**
*Goal: "Aha!" moment < 2 minutes without connecting real Notion.*

*   **L6.1: Design Sandbox Experience & Data**
    *   Task: Define a realistic but manageable set of fake Notion workspace data (pages, databases, blocks) to serve as the sandbox. (✅ **Done**)
    *   Task: Create this data as a JSON structure. (✅ **Done** - `demo-data/*.json` created).
*   **L6.2: Mock API for Sandbox Mode**
    *   Task: Create a "mock" version of key backend APIs (`/app/api/demo-api/[...slug]/route.ts`) (✅ **Done**).
    *   Task: This mock API should simulate delays and state changes (e.g., snapshot "pending" then "completed"). (✅ **Partially Done** - Basic simulation in place).
*   **L6.3: Enhance `react-joyride` Tour (from A13)**
    *   Task: Identify if user is in "sandbox mode" (e.g., new user, query param, local storage flag). (✅ **Done** - `useSandbox` hook).
    *   Task: If in sandbox mode, `react-joyride` steps should target UI elements interacting with the mock data/API. (✅ **Done** - `Tour.tsx` has conditional steps).
    *   Task: Tour steps to guide user through:
        *   Viewing the pre-loaded sandbox workspace.
        *   "Creating" a snapshot of the sandbox data.
        *   "Restoring" a part of the sandbox data.
        *   Highlighting key features based on the sandbox interactions. (✅ **Done** - Steps defined).
*   **L6.4: Sandbox UI Integration**
    *   Task: Modify dashboard/snapshot table to display sandbox data and use mock APIs when in sandbox mode. (✅ **Done** - `apiClient` and dashboard logic support this).
    *   Task: Ensure UI elements targeted by the tour are present and functional in sandbox mode. (➡️ **Partially Done** - Placeholders exist; full UI might change targets).
*   **L6.5: Call to Action & Conversion Tracking**
    *   Task: At the end of the sandbox tour, present a clear Call to Action (CTA) to "Connect your real Notion workspace". (✅ **Done** - In tour and demo banner).
    *   Task: Implement PostHog event capture for `sandbox_tour_completed_cta_clicked`, `sandbox_demo_started`. (✅ **Done** - `sandbox_tour_completed_cta_clicked`, `sandbox_demo_started`).

---

**Epic L7: Usage-based pricing & seat overage meter**
*Goal: Align revenue with heavy users; prevent "value leakage".*

*   **L7.1: Define Usage Metrics & Firestore Structure**
    *   Task: Identify specific metrics for usage-based billing (e.g., number of snapshots beyond plan limit, storage used beyond limit, number of active seats for Teams plan).
    *   Task: Design Firestore structure to track monthly usage per user, e.g., `usage/{uid}/{year_month}` doc with fields like `snapshots_count`, `storage_gb_hours`, `active_seats_max`.
*   **L7.2: Implement Usage Tracking in Workers/APIs**
    *   Task: Modify relevant Cloud Functions (e.g., `snapshot-worker`, `stripeWebhook` for seat updates) to increment/update usage data in Firestore in near real-time or batched.
        *   Snapshot worker: increment `snapshots_count`.
        *   Stripe webhook: update `active_seats_max` based on subscription quantity.
        *   (If storage is metered): A separate function to calculate storage usage (e.g., sum of GCS object sizes, potentially gb-hours).
*   **L7.3: Stripe Metered Billing Configuration**
    *   Task: In Stripe, create new metered Price(s) for relevant plans (or add metered components to existing plans).
    *   Task: Configure `reporting_category` (e.g., "snapshots_extra", "seats_overage") for metered items.
*   **L7.4: Stripe Usage Reporting (New Cron Job or Worker)**
    *   Task: Create a new Cloud Function (e.g., `reportUsageToStripeTrigger`) scheduled daily (or more frequently).
    *   Task: This function will:
        *   Query the `usage/{uid}/{year_month}` Firestore docs for all relevant users.
        *   For each user with a metered subscription, create Stripe Usage Records using `stripe.subscriptionItems.createUsageRecord()` for each metered component.
        *   Handle idempotency keys carefully to avoid double-reporting.
*   **L7.5: Dashboard Usage Gauge & Alerts**
    *   Task: Enhance the dashboard's quota display (currently `QuotaProgressButton`) to show more detailed usage against metered limits if applicable (e.g., "You've used 50/100 included snapshots. Extra snapshots will be billed at $X/each.").
    *   Task: Implement email/in-app notifications when a user reaches 80% and 100% of a metered usage component included in their base plan, before overages apply. (Requires `email-worker` or similar to send these).

---

**Epic L8: Multi-tenant region isolation & data residency selector**
*Goal: EU customers demand data stays in EU; US wants low-latency.*

*   **L8.1: Region Configuration & Parameterization**
    *   Task: Define supported regions (e.g., `europe-west3`, `us-central1`).
    *   Task: Parameterize infrastructure components to be region-specific:
        *   GCS Bucket names (e.g., `pagelifeline-snapshots-europe-west3`).
        *   Firestore instances (requires separate GCP projects for true Firestore regional isolation, or careful data sharding/tagging within one instance if only logical separation is initially feasible). True instance isolation is better for residency.
        *   Pub/Sub topic names (e.g., `europe-west3-snapshot-jobs`, `us-central1-restore-jobs`).
        *   Cloud Function deployment regions.
*   **L8.2: Sign-up Flow Update**
    *   Task: Add a "Preferred Data Region" selector to the user sign-up flow.
    *   Task: Store the selected region in `users/{uid}/settings`.
*   **L8.3: Region-Aware Resource Creation & Routing**
    *   Task: Modify user creation logic (e.g., on first sign-in webhook from Clerk) to provision resources (or identifiers for resources) in the user's chosen region.
    *   Task: Update API routes that trigger worker jobs (e.g., `/api/snapshots/create`, `/api/restore`) to publish to region-specific Pub/Sub topics based on the user's stored region.
*   **L8.4: Worker Deployment and Configuration**
    *   Task: Deploy instances of workers (`snapshot-worker`, restore worker, etc.) in each supported region.
    *   Task: Configure each regional worker to listen to its region-specific Pub/Sub topics and interact with its region-specific GCS buckets and Firestore (if using separate instances).
*   **L8.5: Data Access Logic Updates**
    *   Task: Ensure all data access logic (APIs fetching snapshots, user data, etc.) correctly targets the resources in the user's designated region. This might involve passing region context or having the user's region implicitly determine the data source.
*   **L8.6: Billing & Cost Allocation**
    *   Task: If possible, tag regional resources in GCP for cost allocation.
    *   Task: (Internal) Update billing analysis to track costs per region.
*   **L8.7: Documentation & Compliance**
    *   Task: Update privacy policy and terms of service to reflect data residency options and commitments.
    *   Task: Prepare documentation for customers regarding data residency.




UX Work-Items Required for the Upcoming Road-map

#	Area / Feature	Why It Matters	Key UX Deliverables
1	AI "Smart Snapshot" surfaces	Users must understand and trust the new AI insights.	• Empty-state & tooltip copy explaining "Smart Snapshot"• Results screen layout: diff summary cards + "Ask AI" panel• Loading & error states when Pinecone / LLM time-out• Visual indicator of confidence / similarity score (e.g., heat bar)
2	Semantic Diff Picker	Selecting two snapshots can feel technical.	• Calendar-style snapshot selector (from → to)• Inline diff tally ("12 pages changed") before click-through• "Compare with previous" one-click shortcut
3	AI Chat Panel	Conversational answers drive adoption but can overwhelm UI.	• Slide-over drawer with chat history• Prompt suggestions ("What changed in Marketing DB?")• Copy icon & citation links to original blocks• Guard-rails / disclaimer copy
4	Sandbox Demo Flow	Core to activation; must feel playful & risk-free.	• Entry banner "Try the live demo →" on landing• Joyride step targets + highlights• Reset / rerun demo button• Distinct color theme or watermark to signal "demo mode"
5	Storage-Replication Settings	Power users need clarity on where data lives.	• Wizard-style setup (Choose provider → enter keys → test connection)• Inline helper graphics for S3 vs R2 bucket paths• Success badge & last-replicated timestamp
6	Audit Log Page	Security buyers look for transparency.	• Table with iconography per event type (snapshot, restore, billing)• Filter chips (type, date range, status)• CSV export button confirmation toast
7	Usage / Overage Meter	Prevent bill-shock; boost upsell.	• Progress ring with dynamic color (green < 80 %, amber < 100 %, red > 100 %)• Tooltip: "Extra snapshots $0.10 each"• Alert banner when 90 % threshold crossed
8	Theme Toggle (Light / Dark / System)	Requested polish item; improves accessibility.	• Dropdown with sun / moon / laptop icons• Immediate visual feedback; store pref callout• Ensure charts & progress bars invert colors correctly
9	Public Status Badge	Social proof & trust; embed-able.	• Tiny badge style guide (SVG + dark-mode)• Expandable panel with uptime history graph
10	Desktop Tray "Panic Restore"	Must be brain-dead simple in crisis.	• One-click restore button + confirmation dialog• Progress toast notifications• Post-success deep-link "Open in Notion"
11	SSO & Role Management Admin	Enterprise admins demand friction-free controls.	• Role dropdown inline-edit table• Empty-state illustration when no team members• Audit trail inline ("Sarah promoted to Admin 2 h ago")
12	Region Selector (Signup)	Legal / compliance clarity.	• Radio-card layout with flag icons + latency note• Tooltip: "We replicate within chosen region only."
13	Post-Snapshot Success Modal	Drive next action after core task.	• Summary ("Snapshot #23 saved, 4 MB")• CTA buttons: "Compare to previous" / "Download JSON"
14	Error & Empty States Overhaul	Many new async flows mean more failure modes.	• Unified illustration & copy library• Retry / contact-support links with automatic context capture

Hand-off package: each item needs 🎨 Figma wireframes, 📝 micro-copy, and ✅ acceptance criteria before dev tickets start.

Let me know if you need deeper specs or prioritization of these UX tasks!

**Specific Tasks Recently Completed (User Request):**

*   **Implement Real Logic for ONE Placeholder API (`/api/analytics/kpis/route.ts`):** (✅ **Done**)
    *   Replaced placeholder API with logic to count user's total snapshots and get timestamp of the latest one from Firestore.
    *   Created `src/hooks/useKpis.ts` SWR hook.
    *   Updated dashboard page to use the hook and display this real data in a `KpiCard`.
*   **Refine Frontend Data Mapping (`ComparisonEngineBar.tsx`):** (✅ **Done**)
    *   Updated display labels in `ComparisonEngineBar.tsx` to "Confidence", "Added", "Modified", "Removed".
    *   Ensured "Modified" count uses `contentHashChanged` from the diff summary.