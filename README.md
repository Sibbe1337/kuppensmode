# Notion Recovery Kit Template

This directory contains the "Notion Recovery Kit" template, provided by Pagelifeline.

## About This Template

The Notion Recovery Kit is designed to help you quickly restore your essential Notion pages and databases in case of accidental data loss or a workspace issue. It provides a structured way to organize your critical information backups.

*(Users should replace this section with a more detailed description of the template's contents and benefits.)*

## How to Use

1.  **Download the `.zip` file** from this directory (or from where it's distributed).
2.  **Import into Notion:** Unzip the file and import the `.html` or `.md` files into your Notion workspace. Refer to Notion's official documentation for the latest import instructions.
3.  **Customize:** Adapt the template structure to fit your specific needs.

## Feedback

If you have any feedback or suggestions for this template, please let us know!

## Compliance Platform Integration (Vanta/Secureframe)

This project is ready for integration with a compliance automation platform such as Vanta or Secureframe.

### Steps to Integrate
1. Sign up for Vanta or Secureframe and onboard your organization.
2. Follow the platform's instructions to install their agent/webhook on your infrastructure.
3. (For Vanta) Typically, run a script or install a package on your CI/CD runners and production servers:
   ```sh
   # Example for Vanta (see Vanta docs for latest)
   curl -fsSL https://get.vanta.com/install.sh | bash
   # Or for Secureframe, follow their onboarding instructions
   ```
4. Add any required environment variables or API keys to your CI/CD and production environments.
5. Confirm that the agent is reporting data in the Vanta/Secureframe dashboard.

> **Note:** No agent or webhook code is present in this repo by default. This section is a placeholder for your compliance automation setup. Update this section with your actual integration steps as needed.

## Automated Policy Documentation

All security policies and procedures required for compliance (e.g., SOC 2, ISO 27001) should be maintained as code in the `policies/` directory at the root of this repository.

### How to Use
1. Store each policy as a Markdown file (e.g., `access-control-policy.md`, `incident-response-policy.md`).
2. Update policies as your organization or compliance requirements evolve.
3. Link to these documents in your compliance platform (Vanta/Secureframe) as evidence.
4. Use version control to track changes and approvals.

> **Note:** If the `policies/` directory does not exist, create it and add your policy documents. See the example below.

Example:
```
notion-lifeline/
  policies/
    access-control-policy.md
    incident-response-policy.md
    data-backup-policy.md
    ...
```

## Penetration Testing & Vulnerability Scanning

Regular vulnerability scanning and periodic penetration testing are required for compliance.

### How to Use
1. Run vulnerability scans locally and in CI:
   ```sh
   # Run npm audit for all packages
   npm audit --audit-level=high
   # Or with pnpm
   pnpm audit --audit-level=high
   # Optionally, use Snyk for deeper scanning (requires signup)
   npx snyk test
   ```
2. Address any high or critical vulnerabilities before deploying to production.
3. Schedule third-party penetration tests at least annually and after major changes.
4. Store pen test reports and scan results in the `evidence/` directory or upload to your compliance platform.

> **Note:** To automate this, add npm audit and/or Snyk to your CI pipeline. See your CI provider's documentation for details.

## Employee Security Training

All employees must complete security awareness training annually and upon hire. Evidence of training completion should be tracked for compliance.

### How to Use
1. Assign security awareness training to all employees (e.g., via your compliance platform, HR system, or a third-party provider).
2. Track completion dates and maintain a record of all employees who have completed training.
3. Store evidence (e.g., completion certificates, screenshots, or reports) in the `evidence/employee-training/` directory or upload to your compliance platform.
4. Review and update training content annually or as regulations change.

> **Note:** If the `evidence/employee-training/` directory does not exist, create it and add your training evidence files.

## Log Export & SIEM Integration

Centralized log export is required for security monitoring and compliance. All application and infrastructure logs should be exported to a SIEM (e.g., BigQuery, Splunk, Sumo Logic) for analysis and retention.

### How to Use
1. In Google Cloud Console, set up a Log Sink to export logs to BigQuery or your SIEM provider.
2. Use Terraform to automate log sink creation and permissions (see example below).
3. Ensure all relevant logs (Cloud Functions, GCS, IAM, etc.) are included in the export.
4. Set up log-based metrics and alerts in your SIEM or Google Cloud Monitoring.

> **Note:** Add your log sink Terraform code to `terraform/` and keep your SIEM integration up to date with compliance requirements.

Example Terraform snippet:
```hcl
resource "google_logging_project_sink" "main" {
  name        = "export-logs-to-bigquery"
  destination = "bigquery.googleapis.com/projects/YOUR_PROJECT/datasets/YOUR_DATASET"
  filter      = ""
}
```

## SLO/KPI Monitoring

Service Level Objectives (SLOs) and Key Performance Indicators (KPIs) are required for compliance and operational excellence. Monitoring and alerting should be set up for critical metrics (e.g., uptime, error rate, latency, backup success rate).

### How to Use
1. Define SLOs and KPIs for your application (e.g., 99.9% uptime, <1% error rate, daily backup success).
2. Use Google Cloud Monitoring, Sentry, or your SIEM to create dashboards and alerts for these metrics.
3. Store evidence of SLO/KPI monitoring (e.g., screenshots, reports, alert logs) in the `evidence/slo-kpi/` directory or upload to your compliance platform.
4. Review and update SLOs/KPIs annually or as your business evolves.

> **Note:** If the `evidence/slo-kpi/` directory does not exist, create it and add your monitoring evidence files.

## Automated Audit Support

Automated audit support streamlines evidence collection and reporting for compliance audits (e.g., SOC 2, ISO 27001).

### How to Use
1. Use scripts or scheduled jobs to periodically collect evidence (e.g., logs, policy snapshots, training records).
2. Store all audit evidence in the `evidence/` directory, organized by category (e.g., logs, policies, training, SLOs).
3. Generate periodic audit reports (e.g., monthly, quarterly) and store them in `evidence/audit-reports/`.
4. Provide auditors with read-only access to the `evidence/` directory or export evidence as required by your compliance platform.
5. Review and update your evidence collection process annually or after major changes.

> **Note:** If the `evidence/audit-reports/` directory does not exist, create it and add your audit reports and supporting evidence.

## Redundant Storage for Snapshots

To enhance data durability and availability, this application supports redundant storage for snapshots. Snapshots are always written to a primary Google Cloud Storage (GCS) bucket, and can additionally be mirrored to one or more secondary storage providers.

### Supported Mirror Providers:
*   AWS S3
*   Cloudflare R2

### How it Works:
*   **Writes**: When a snapshot is created, the `RedundantStorageAdapter` attempts to write the data to the primary GCS bucket and simultaneously to all configured and enabled mirror providers (S3, R2). The overall write operation is considered successful if the data is written to *at least one* of these storage locations. If writes to some providers fail (including potentially the primary), but at least one succeeds, the operation is still successful, though warnings may be logged. The write only fails entirely if *all* attempts to all configured storage providers (primary and mirrors) are unsuccessful.
*   **Reads**: Snapshot data is primarily read from the GCS bucket. If a read from GCS fails, the system will attempt to read the data from the configured mirror providers in sequence until the data is successfully retrieved.
*   **Deletes**: Delete operations are issued to the primary GCS bucket and all configured mirrors. A delete is considered successful if at least one provider acknowledges the deletion.
*   **Configuration**: Mirroring is configured on a per-user basis via their storage provider settings, typically managed through the application's dashboard. Credentials for mirror providers are stored encrypted and decrypted at runtime by the snapshot worker.

This multi-provider strategy significantly reduces the risk of data loss due to an outage or issue with a single storage provider.

## Local Development & Deployment

### Environment Variables

This project uses Vercel for hosting and managing environment variables for development, preview, and production deployments.

**NEVER commit sensitive environment variables (API keys, service account JSON strings, etc.) directly to the repository or in `.env.local` files that are not gitignored.**

To add or update environment variables, use the Vercel dashboard or the Vercel CLI:

**Using Vercel CLI:**

1.  **Install Vercel CLI:**
    ```bash
    npm i -g vercel
    ```

2.  **Link your local project to Vercel (if not already done):**
    ```bash
    vercel link
    ```

3.  **Add an environment variable:**
    Replace `VARIABLE_NAME` with the actual name of the variable (e.g., `GCP_SERVICE_ACCOUNT_KEY_JSON`, `STRIPE_SECRET_KEY`).
    ```bash
    # Adds to all environments (Development, Preview, Production)
    vercel env add VARIABLE_NAME

    # Add to Production only
    vercel env add VARIABLE_NAME PRODUCTION

    # Add to Development only
    vercel env add VARIABLE_NAME DEVELOPMENT
    ```
    You will be prompted to enter the value for the variable.

4.  **Adding multiline variables (like JSON keys):**
    It's often easiest to paste multiline values directly when prompted by `vercel env add VARIABLE_NAME`.
    Alternatively, for a variable from a file (e.g., a service account JSON key):
    ```bash
    # Ensure your shell correctly handles multiline strings and special characters.
    # This command reads the file content and passes it as the variable's value.
    # Make sure the file (e.g., your-service-account-key.json) is NOT committed to the repo.
    vercel env add YOUR_ENV_VAR_NAME "$(cat path/to/your-service-account-key.json)"
    ```
    Be cautious with special characters in the file content; you might need to escape them or use the Vercel dashboard for complex values.

5.  **To pull down environment variables locally (creates `.env.development.local`):**
    ```bash
    vercel env pull .env.development.local
    ```
    Ensure `.env*.local` files are listed in your `.gitignore` file.

Refer to the official [Vercel Environment Variables Documentation](https://vercel.com/docs/projects/environment-variables) for the most up-to-date information and advanced configurations.

### Required Environment Variables
*(This list should be maintained and kept up-to-date. Ensure these are set in Vercel for deployed environments.)*

**Core Application & GCP:**
*   `GCP_SERVICE_ACCOUNT_KEY_JSON`: (Service account JSON string for GCP access - multiline)
*   `GOOGLE_CLOUD_PROJECT`: (Your GCP Project ID)
*   `GCS_BUCKET_NAME`: (Name of the primary GCS bucket for snapshots)
*   `PUBSUB_SNAPSHOT_TOPIC`: (Pub/Sub topic for snapshot requests, e.g., `notion-lifeline-snapshot-requests`)
*   `PUBSUB_RESTORE_TOPIC`: (Pub/Sub topic for restore requests, e.g., `notion-lifeline-restore`)
*   `PUBSUB_DIFF_TOPIC`: (Pub/Sub topic for diff requests, e.g., `notion-lifeline-diff-requests`)
*   `KMS_KEY_RING_ID`: (GCP KMS Key Ring ID for decrypting storage credentials - required if using encrypted mirror credentials)
*   `KMS_KEY_ID`: (GCP KMS Key ID for decrypting storage credentials - required if using encrypted mirror credentials)
*   `KMS_LOCATION_ID`: (GCP KMS Location ID - required if using encrypted mirror credentials)

**Authentication (Clerk):**
*   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: (Clerk Publishable Key)
*   `CLERK_SECRET_KEY`: (Clerk Secret Key)

**Payments (Stripe):**
*   `STRIPE_SECRET_KEY`: (Stripe Secret Key)
*   `STRIPE_WEBHOOK_SECRET`: (Stripe Webhook Secret for your endpoint)
*   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: (Stripe Publishable Key for client-side)

**Monitoring & Analytics (Optional for local dev, recommended for prod):**
*   `SENTRY_DSN`: (Sentry DSN for error monitoring)
*   `SENTRY_AUTH_TOKEN`: (Sentry Auth Token for uploading source maps)
*   `NEXT_PUBLIC_POSTHOG_KEY`: (PostHog Public API Key)
*   `NEXT_PUBLIC_POSTHOG_HOST`: (PostHog Host, e.g., `https://app.posthog.com`)

**Storage Mirroring (Credentials for these are typically user-provided & encrypted; worker decrypts at runtime. Below are for system-level defaults/testing if ever needed by worker directly):**
*   *(Note: User-specific S3/R2 credentials for mirrors are fetched from Firestore by the snapshot-worker and decrypted at runtime using KMS. The variables listed below are for system-level defaults or direct worker access, which is generally not the primary flow for user data mirroring.)*
*   `AWS_ACCESS_KEY_ID_WORKER_DEFAULT`: (Optional: Default AWS Access Key ID for snapshot-worker S3 access, if needed beyond user-provided keys)
*   `AWS_SECRET_ACCESS_KEY_WORKER_DEFAULT`: (Optional: Default AWS Secret Access Key for snapshot-worker S3 access)
*   `AWS_REGION_WORKER_DEFAULT`: (Optional: Default AWS Region for snapshot-worker S3 access)
*   `CF_R2_ACCOUNT_ID_WORKER_DEFAULT`: (Optional: Default Cloudflare Account ID for snapshot-worker R2 access)
*   `CF_R2_ACCESS_KEY_ID_WORKER_DEFAULT`: (Optional: Default R2 Access Key ID for snapshot-worker R2 access)
*   `CF_R2_SECRET_ACCESS_KEY_WORKER_DEFAULT`: (Optional: Default R2 Secret Access Key for snapshot-worker R2 access)

**Build & API URLs:**
*   `NEXT_PUBLIC_API_BASE_URL`: (Base URL for your API, e.g., `http://localhost:3000` for dev, or your production domain)
*   `VERCEL_URL`: (Often set automatically by Vercel, can be useful for constructing dynamic URLs)

*(This list should be maintained and kept up-to-date.)*

---

**Built with [Pagelifeline](https://pagelifeline.app?ref=template)** - Automated Notion Backups & Restore. 