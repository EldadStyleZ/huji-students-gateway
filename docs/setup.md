# Get the gateway online

The recommended pilot uses **one Railway service + one Supabase project + Resend**. Resend handles both sign-in codes and forwarded requests. AI is optional and starts off. No separate frontend host, queue server, analytics service or public admin dashboard is required.

Start with a staging environment. There are no live credentials configured in this repository, and nothing has been deployed or emailed on your behalf.

## 1. Prepare the accounts and sending domain

- Create organization-owned accounts at [Railway](https://railway.com), [Supabase](https://supabase.com/dashboard) and [Resend](https://resend.com). Enable two-factor authentication and give access only to the people operating the gateway.
- Ask whoever manages `aguda.org.il` DNS to help verify a sending subdomain in Resend, for example `notify.aguda.org.il`. This is a proposed subdomain, not an existing service. Add the exact DNS records Resend displays. Do not replace the domain's existing mailbox/MX configuration.
- After domain verification, choose a sender such as `gateway@notify.aguda.org.il`. Create a sending-only API key scoped to that domain. Use a separate key for Supabase SMTP so either can be rotated independently. [Resend domain documentation](https://resend.com/docs/dashboard/domains/introduction)

## 2. Set up Supabase

1. Create a dedicated staging project. Choose an appropriate region with the union's data owner and keep the app/database regions close for latency.
2. Open **SQL Editor**. Run the four files in `supabase/migrations/` in filename order, once each. Existing installations should run only unapplied migrations. Do not run the SQL test files in a real project.
3. Copy the project URL, publishable key and secret key into the Railway variables in step 4. Keep the secret key server-side. The app also supports the older `SUPABASE_SERVICE_ROLE_KEY` during migration. [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys)
4. Open **Authentication → Email → SMTP Settings**. Enable custom SMTP and enter the values below. The built-in Supabase sender is restricted and unsuitable for a student-facing service. [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)

| SMTP field     | Value                              |
| -------------- | ---------------------------------- |
| Host           | `smtp.resend.com`                  |
| Port           | `465`                              |
| Username       | `resend`                           |
| Password       | Your dedicated Resend SMTP API key |
| Sender address | Your verified sender               |
| Sender name    | The union's service name           |

These settings follow [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp). Keep email confirmation enabled. In Supabase's email templates, include `{{ .Token }}` for both **Confirm signup** and **Magic link** so first-time and returning users receive a code. Set the code lifetime to 10 minutes and review Auth email/send limits for your pilot size. The app accepts 6–10 digit codes.

## 3. Review the two small configuration files

The PDF supplied 16 mailboxes; `config/roles-source.json` records role titles and addresses, without publishing staff names or the original PDF. `config/directory.json` contains a provisional map based on those titles, as requested. Exact duties can be refined later; see [the contact map](contact-map.md).

Before sending real requests:

- Have the receiving teams agree to monitor the proposed routes, including the **office mailbox as the provisional general-help fallback**. For each active directory entry, set `approved` to `true`, fill `approvedBy` and choose a `validUntil` review date. The checked-in entries remain unapproved and expire on 13 December 2026 as a provisional review reminder.
- In `config/service.json`, fill `privacyEmail`, choose `retentionDays` (the proposed value is 90), edit the Hebrew/English response expectations, and review `/privacy`. Set `approved` to `true` once the operator agrees to the actual data handling. Change `noticeVersion` whenever the material notice changes.
- For staging, use a reviewed staging directory whose entries all point to mailboxes you control. Do not test by sending requests to the real role addresses.

The developer can make these edits for you after you provide the decisions. You do not need to learn the JSON format. This is service configuration, not a requirement to finish every detailed role definition before a pilot.

## 4. Deploy one Railway service

1. Create a project → deploy from GitHub → select `EldadStyleZ/huji-students-gateway`.
2. Railway reads the Dockerfile and `railway.json`. Create **one service**. Generate its public HTTPS domain and use that exact origin below, without a final `/`.
3. Open **Variables** and enter the values in this table. Never paste API keys into chat, commit them to GitHub, or prefix them with a browser/public environment variable convention.

| Variable                              | Value                                               |
| ------------------------------------- | --------------------------------------------------- |
| `GATEWAY_MODE`                        | `live`                                              |
| `APP_ORIGIN`                          | The exact Railway HTTPS origin                      |
| `HOST`                                | `0.0.0.0`                                           |
| `SUPABASE_URL`                        | Your project HTTPS URL                              |
| `SUPABASE_PUBLISHABLE_KEY`            | Your Supabase publishable key                       |
| `SUPABASE_SECRET_KEY`                 | Your Supabase secret key                            |
| `RESEND_API_KEY`                      | Your scoped sending API key                         |
| `MAIL_FROM`                           | Your verified plain sender address                  |
| `RATE_LIMIT_SECRET`                   | A randomly generated secret, at least 32 characters |
| `ROUTING_POLICY_APPROVED`             | `true`, after step 3                                |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `35`                                                |

Generate `RATE_LIMIT_SECRET` locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste the result directly into Railway. Let Railway assign `PORT`. Leave `BACKGROUND_WORKER` unset; the sender is included by default. Leave all `AI_*` variables unset for the initial pilot.

4. Keep the service running continuously; do not enable sleeping/serverless suspension. The sender checks Postgres for queued work. The healthcheck is `/readyz`, which waits for database/schema/background readiness. Railway checks this during deployment; arrange ongoing operational monitoring separately. Give shutdown the 35-second grace period above. [Railway healthchecks](https://docs.railway.com/deployments/healthchecks), [draining variable](https://docs.railway.com/variables/reference)
5. Set Supabase Auth's Site URL to the same public HTTPS origin. Deploy and open the URL. A failed deployment before configuration is complete is intentional; the logs identify missing configuration without showing keys.

Optional local readiness check: copy `.env.example` to the ignored `.env`, fill it privately, then run `npm run doctor`. It makes no network requests and sends no email.

## 5. Turn on delivery notifications

1. In Resend → **Webhooks**, add `https://YOUR-APP/api/webhooks/resend`.
2. Select `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed`. No click/open tracking is needed.
3. Copy the webhook signing secret to Railway as `RESEND_WEBHOOK_SECRET` and redeploy.
4. Use a synthetic staging request and confirm a delivery event appears in Resend and the student's status changes correctly.

The endpoint verifies the signature over the raw bytes, checks a five-minute timestamp window and deduplicates event IDs. It handles notifications arriving before the sending worker's acknowledgement and out of order. A delivery event confirms arrival at the recipient's mail server, not reading or case resolution. [Resend delivery guarantees](https://resend.com/docs/webhooks/introduction), [event definitions](https://resend.com/docs/webhooks/event-types)

## 6. Run the staging checklist

Use accounts and receiving mailboxes that you control:

1. Submit one Hebrew and one English request; verify the code arrives, the displayed recipient is correct, the forwarded email arrives once, and a staff reply reaches the verified address.
2. Retry a submission after a temporary connection failure. Confirm the original reference is returned and there is still only one forwarded email.
3. Enter an incorrect/expired OTP and recover. Sign out and sign back in. Verify another account cannot look up the first account's request by reference.
4. Simulate a provider failure in staging, check `npm run ops -- status`, correct the configuration, and follow [operations](operations.md). Do not blindly resend an ambiguous email.
5. Check the service on a phone and with keyboard navigation. Ask Hebrew-speaking students to complete three typical tasks without coaching.
6. Agree who checks failed deliveries, who owns privacy requests, and how staff acknowledge/resolve cases. Configure Railway deployment/crash notifications, use `operator_attention` logs, and have an operator run the queue check daily. A running web process does not prove emails are being delivered.

## 7. Open a small pilot, then expand

Use a separate production project/service and verified directory. Start with a small group, review wrong-recipient reports and completion times, and correct the mapping. Add exact university department handoffs when those contacts are supplied. Basic university links remain explicitly labelled general guidance.

For the pilot, staff work in their existing mailboxes; the local operations command records handling status. Replies are not ingested as a conversation. Unsolved sensitive requests require an agreed human handling path; this code does not invent a confidential office or emergency procedure.

AI can be enabled later with the existing self-hosted adapter after checking new, independent Hebrew examples and choosing where inference runs. A model running on your laptop is not a reliable production dependency. The app's keyword fallback and guided selection continue to work without a model service.
