# Staging setup

Use a dedicated Supabase project and a dedicated hosting service for synthetic testing. Never point staging at a production database: the staging policy deletes request records after seven days.

Set these variables alongside the normal live credentials in [setup.md](setup.md):

| Variable        | Value                                          |
| --------------- | ---------------------------------------------- |
| `GATEWAY_MODE`  | `live` (uses real authentication and delivery) |
| `GATEWAY_STAGE` | `staging`                                      |
| `STAGING_INBOX` | One mailbox controlled by the tester           |

Keep the test address in hosting variables or an ignored local environment file. Do not put it in the checked-in directory. `STAGING_INBOX` without the explicit staging switch prevents startup.

Staging preserves the topic-to-role mapping but directs every role to the test inbox. The interface labels the environment and each contact as a test. Requests are marked `[STAGING TEST]`. Only the configured address can request a sign-in code, verify a code, submit a request or retrieve request status through the gateway. Authentication still requires a real verified Supabase session.

The mail worker separately checks frozen queue payloads before contacting Resend. It blocks other recipients, CC/BCC and replies to other addresses, including jobs left over from a previous configuration. Changing the inbox changes the directory version, requiring a fresh recipient review.

Staging uses a separate bilingual notice, seven-day request retention and the test inbox as the staging support contact. It does not approve the production routing or privacy files. Keep test descriptions invented; authentication accounts, mailbox copies and provider logs need separate cleanup. AI remains optional and should initially be left off.

## Domain and authentication

For a first test, Resend's `onboarding@resend.dev` sender can send only to the email associated with the Resend account. The tester must confirm that sender and account address before using it. Other recipients require a verified sending domain. A future union-owned subdomain can be used without buying a separate domain. [Resend test-domain limits](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

Configure Supabase SMTP with the chosen sender and a separate sending-only Resend key, following [setup.md](setup.md). The MCP connection does not configure runtime credentials or SMTP automatically. Put secret keys directly into hosting variables; never paste them into a task or commit them.

## Hosting preparation, 27 September 2026

The staging service is connected to this repository. Its assigned origin is `https://huji-students-gateway-production.up.railway.app`, with port `4173` and healthcheck `/readyz`. The Railway environment and generated hostname use the label `production`; the application is explicitly configured with `GATEWAY_STAGE=staging` and a single restricted tester inbox.

Fifteen service variables have been set, including the Supabase server secret, application email credentials, the database publishable key and the webhook signing secret. Two sending-only Resend keys were created: one for application messages and a separate one for Supabase SMTP. The delivery webhook subscribes to the six events listed in the setup guide. Local credential files are ignored by Git and readable only by their owner; no credential values are recorded here.

After the operator added the server secret, Railway reported a successful deployment. Both `/healthz` and `/readyz` returned HTTP 200, and `/api/config` confirmed live provider connections, staging restrictions and AI disabled. The hosted operations check reported schema version 4, an empty queue and no cases needing attention.

The initial browser test reached the Hebrew review screen and requested a sign-in code successfully. Supabase's Auth logs recorded its built-in sender, `noreply@mail.app.supabase.io`, so custom Resend SMTP had not taken effect at that checkpoint. Finish saving custom SMTP and the code templates before completing the authenticated request/delivery test. The MCP does not expose Auth configuration. Creating a webhook is not evidence that it has received or validated an event; the real forwarded message and signed delivery callback remain unverified.

## Database history

The original four migrations were applied successfully to the designated empty staging project on 27 September 2026. Their filenames now match the versions recorded by Supabase:

| Previous filename           | Current filename                       |
| --------------------------- | -------------------------------------- |
| `001_gateway.sql`           | `20260927120211_gateway.sql`           |
| `002_idempotent_replay.sql` | `20260927120218_idempotent_replay.sql` |
| `003_email_reference.sql`   | `20260927120225_email_reference.sql`   |
| `004_operations.sql`        | `20260927120231_operations.sql`        |

The SQL content is unchanged. On an existing installation, check migration history and applied schema before running anything; do not apply the same migration twice because its filename changed.

Checks on that staging database confirmed schema version 4, an empty request queue, RLS on all six tables and no direct table/function privileges for anonymous or authenticated browser roles. Supabase reports six informational “RLS Enabled No Policy” entries: this is intentional for these server-only tables. Requests pass through the gateway's verified-owner checks and service-role RPCs. Do not add broad browser policies to silence the notice. [Supabase advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Before deployment

1. Activate hosting billing if the Railway trial has expired; connecting its plugin does not activate a plan.
2. Create the dedicated staging service and set runtime credentials plus the staging variables above.
3. Set the exact HTTPS origin, Supabase SMTP and the delivery webhook.
4. Run the staging checklist in [setup.md](setup.md). A successful MCP email check tests the provider connection only; it does not prove the application sign-in and forwarding flow works.

For production, use a separate database and service, set `GATEWAY_STAGE=production`, remove `STAGING_INBOX`, and complete the real directory and service-policy review. Production startup continues to require those approvals.
