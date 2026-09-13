# Hebrew University student support gateway

A Hebrew-first, English-enabled starter for guided student requests, natural-language topic suggestions and reliable email forwarding. Includes a [detailed research report](docs/research.md) and [readable research site](public/research.html).

**It starts in demo mode.** Demo text stays in page memory unless model suggestions are explicitly enabled. No live requests or emails are sent in demo mode. An approved role directory and external service configuration are required for live intake.

**Next step: [easy setup guide](docs/setup.md).** The pilot now uses one Railway application service, Supabase and Resend. The [provisional role map](docs/contact-map.md) uses the supplied staff PDF; exact responsibilities can be refined later. [Operations](docs/operations.md) covers delivery, status and deletion.

## Run locally

Requires Node.js 22 or newer. The application has no runtime npm dependencies. Run `npm ci` to install the pinned development tools for browser testing, formatting and rebuilding the report.

```sh
npm start
```

Open http://127.0.0.1:4173. The main demo includes topic selection, a course-registration branch, campus selection, a university information handoff, union request preparation, review and draft download. A deep link such as `/?topic=course-registration&lang=he` preselects a topic.

```sh
npm test
npm run evaluate
```

The first runs domain/API/worker tests. The second evaluates the keyword baseline on 23 synthetic examples and writes `artifacts/evaluation-keywords.json`. These examples are an integration smoke set, **not** independent production accuracy evidence.

## Enable a local open-weight model

The adapter supports Ollama native structured output and an OpenAI-compatible chat endpoint. It does not require an OpenAI account. No weights are downloaded by the application.

On the development machine used for this build, `gemma4:26b` was already installed in Ollama. For that installation:

```sh
AI_BASE_URL=http://127.0.0.1:11434 \
AI_PROTOCOL=ollama \
AI_MODEL=gemma4:26b \
AI_PROCESSOR_NOTICE='Local model on this computer; text is used to suggest a topic.' \
node server.mjs
```

Alternatively, copy `.env.example` to `.env`, fill the model configuration and run `node --env-file=.env server.mjs`. Keep the endpoint private. Live configuration requires HTTPS for non-loopback model hosts. Model requests disclose the configured processing notice in the interface. Turn the model off by removing `AI_BASE_URL`.

```sh
AI_BASE_URL=http://127.0.0.1:11434 \
AI_PROTOCOL=ollama AI_MODEL=gemma4:26b \
AI_TIMEOUT_MS=60000 npm run evaluate
```

For a compatible vLLM or other server, use its base ending in `/v1`, set `AI_PROTOCOL=openai`, and use its served model identifier. The adapter expects JSON-schema support. Incompatible output, unknown IDs and timeouts fall back to keywords. Repeated valid topic IDs are deduplicated. Production defaults to an 8-second inference timeout. Test the actual model/quantization/server combination before enabling it.

The research compares Gemma, Qwen and multilingual E5. E5 retrieval is a recommended evaluation candidate; **an embedding service is not implemented**. The UI always requires topic confirmation. Neither model text nor client input can choose an arbitrary email recipient.

## Configure Supabase and email delivery

1. Create a **staging** Supabase project. Apply `supabase/migrations/*.sql` in lexical order using the SQL editor or your migration workflow. The SQL is also tested on plain PostgreSQL with `anon`, `authenticated` and `service_role` roles.
2. Configure Supabase email OTP. Set the email template to include `{{ .Token }}`; otherwise Supabase's OTP initiation sends a magic link. Configure a suitable email sender for authentication.
3. Review `config/roles-template.csv`. Add the actual role names, mailboxes, topic/campus scopes, approver and review expiry. Import with `node scripts/import-directory.mjs roles.csv reviewed-directory.json`, inspect the result, then replace `config/directory.json`. Imported text columns documenting examples/exceptions are notes; they do not automatically become executable rules.
4. Create at least one approved, current `triage` entry with wildcard topic and campus scopes. Add more specific entries for approved services. Placeholder `.invalid` addresses cannot be approved. Equal-rank routing conflicts fail closed.
5. Configure a verified sending domain and sender with Resend, then set `RESEND_API_KEY` and `MAIL_FROM`. The adapter uses Resend's API; it can be replaced independently of routing and storage.
6. Set the environment variables below. Supply organization-approved privacy copy, retention procedures, staffing and sensitive-topic handling before accepting real cases. Set `ROUTING_POLICY_APPROVED=true` only after the proposed rules and responsibilities are reviewed.

| Variable                                 | Use                                                             |
| ---------------------------------------- | --------------------------------------------------------------- |
| `GATEWAY_MODE=live`                      | Explicitly enable authenticated intake                          |
| `APP_ORIGIN=https://...`                 | Exact public origin used for CSRF checks; no trailing slash     |
| `HOST=0.0.0.0`                           | Bind the web service inside a hosting container                 |
| `PORT`                                   | Port assigned by the host, or 4173 locally                      |
| `SUPABASE_URL`                           | Staging or production HTTPS project URL                         |
| `SUPABASE_PUBLISHABLE_KEY`               | Auth API key                                                    |
| `SUPABASE_SECRET_KEY`                    | Privileged server-only key; never put it into browser code      |
| `RATE_LIMIT_SECRET`                      | At least 32 random characters used to hash rate-limit subjects  |
| `RESEND_API_KEY`, `MAIL_FROM`            | Sending API key and verified sender                             |
| `ROUTING_POLICY_APPROVED=true`           | Explicit operator acknowledgement of reviewed routing           |
| `AI_BASE_URL`, `AI_PROTOCOL`, `AI_MODEL` | Optional model service configuration                            |
| `AI_API_KEY`                             | Optional model-service bearer credential                        |
| `AI_PROCESSOR_NOTICE`                    | Accurate description of who processes the student's model input |

## Deployment recommendation

Deploy this repository as **one Railway service** running `node server.mjs`. The same process serves the UI/API and runs the background sender and retention maintenance. PostgreSQL provides the durable queue; no additional queue server or worker deployment is needed. Resend also supplies Supabase's SMTP sender for sign-in codes.

The Dockerfile runs as a non-root user and refuses production startup in demo mode. `railway.json` checks `/readyz` for schema/database/background readiness; `/healthz` reports process liveness. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=35` and keep the service awake. See the [setup guide](docs/setup.md) for account, DNS, variables and staging steps.

Static assets are compressed and read into memory at startup, with ETag revalidation. Local synthetic HTTP checks and asset sizes are recorded in `artifacts/performance-local.json`; these exclude external service/network latency. Restart the local server after edits because this small runtime does not include hot reload.

Keep the web UI and API on one origin for the initial release. Vercel or Netlify can host a future frontend, but this long-running Node server and worker are **not** packaged as their serverless functions. A split deployment would require deliberate cookie, CSRF, CORS and worker changes. Do not deploy the current API by copying it into a serverless handler unchanged.

No Supabase project, sending domain or production deployment was created during this build. Live OTP and email delivery must be verified in staging with authorized test accounts and mailboxes.

## Application boundaries

| Path                                 | Responsibility                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `public/app.js`, `public/styles.css` | Student-facing UI, Hebrew/English, review and demo flows                                                            |
| `public/routing.js`                  | Shared topic catalog, keyword baseline and illustrative university-routing logic                                    |
| `src/domain.mjs`                     | Input validation, approved recipient resolution and request fingerprints                                            |
| `src/api.mjs`                        | Same-origin API, authentication checks, rate limits and durable intake                                              |
| `src/supabase.mjs`                   | Supabase Auth and database RPC adapter                                                                              |
| `src/ai.mjs`                         | Optional constrained classification, output validation and fallback                                                 |
| `src/mail.mjs`, `src/background.mjs` | Leased outbox processing and provider idempotency                                                                   |
| `config/directory.json`              | Versioned, reviewable role-to-mailbox directory; actual mailboxes with a provisional, unapproved responsibility map |
| `src/webhook.mjs`                    | Signature-checked delivery notifications, with minimal metadata                                                     |
| `config/service.json`                | Bilingual service notice, privacy contact and retention                                                             |
| `scripts/ops.mjs`                    | Local administrator commands; no public admin UI                                                                    |
| `supabase/migrations`                | Private tables, transactions, permissions, retry leases and rate limits                                             |

## API contract

- `GET /api/config`: public feature flags, notice version and model processing notice; never secrets.
- `GET /privacy`: Hebrew/English privacy notice.
- `GET /api/auth/session`: recover the current verified email from the HttpOnly cookie.
- `POST /api/auth/logout`: clear the local session cookie.
- `POST /api/webhooks/resend`: signed provider notification; uses raw-body signature validation instead of browser Origin checks.
- `POST /api/suggest`: `{text, allowModel:true}`; returns up to three validated topic suggestions and the actual method used. No model call unless configured.
- `POST /api/route`: `{topicId,campus,registrationIssue}`; live mode returns the current approved destination for review.
- `POST /api/auth/request-code`: `{email}`; initiates an OTP email only in live mode.
- `POST /api/auth/verify-code`: `{email,token}`; sets a Secure HttpOnly SameSite cookie.
- `POST /api/tickets`: requires authentication, a UUID `Idempotency-Key`, confirmed topic/context, description, optional name, language, consent, reviewed `destinationId`, `directoryVersion` and `noticeVersion`. Recipient and student identity are derived server-side.
- `GET /api/tickets/:uuid`: authenticated owner-only status lookup. Reference numbers are not authentication tokens.

Browser POST routes require an exact `Origin` match and JSON content type. The raw body is capped at 16 KiB, descriptions at 3,000 characters. The UI retains request state in memory, without localStorage or URL persistence. Email OTP sessions expire and do not silently refresh; users verify again when needed.

## Reliability and operations

Ticket and outbox writes commit together. Repeated requests with the same user/key/body return the same receipt; a changed body using that key conflicts. Delivery payloads and recipients are frozen. A worker claims a job using a two-minute lease, sends with a stable provider key, and acknowledges using a lease token. Old workers cannot overwrite a newer worker's result.

Temporary network/provider failures retry with increasing delays, up to six attempts. Automatic retries stop before 23 hours from the first attempt because the provider's deduplication window is finite. Monitor `gateway_outbox` for `state='failed'`, queued age, expired leases and authentication/provider errors. Reconcile ambiguous sends with the provider before any manual resend. Never change a delivery key merely to bypass a failure.

`provider_accepted` means the sending provider accepted the request. It does not mean inbox delivery, reading or case resolution. Signed notifications separately record delivery, delay, bounce and complaint outcomes. Staff can reply to the verified student address via their mailbox, but those replies are not ingested. Do not claim complete ticket conversation tracking until a helpdesk adapter or staff workflow is implemented.

## Verification

`npm run doctor` checks local deployment configuration without printing secrets. `npm run ops -- status` reports aggregate operational status when configured.

`npm test` runs the dependency-free Node tests. Database tests: apply migrations to an isolated PostgreSQL database and run both SQL files in `tests/`. On macOS with PostgreSQL installed, `npm run test:database` creates and stops a disposable local instance automatically. The test transaction rolls back its records. Never use a production database for these tests.

`scripts/browser-smoke.mjs` is an optional Playwright helper. Run `npm ci` for local QA or supply `PLAYWRIGHT_MODULE` with the path to an existing installation. It uses a fresh headless Chrome profile, localhost and synthetic inputs. `BROWSER_CHANNEL` changes the browser channel. The test verifies Hebrew routing, preserved text, review, draft download, natural-language suggestions, English, mobile layout and topic links. A separate mocked-live browser test verifies the live UI without sending messages.

`scripts/render-research.mjs` regenerates the static research page using the optional `marked` package, or `MARKED_MODULE` pointing to an existing installation. The already generated page requires no package at runtime.

## Before a real launch

The code is a production-oriented foundation, not a complete operated service. The remaining work requires the service accounts, verified sending domain, approved provisional receiving arrangement, reviewed privacy/retention policy and real staging tests. Department-specific university handoffs, a confidential handling procedure, continuous operational alerts, representative capacity/accessibility checks and independent Hebrew model evaluation still need organizational input. Staff can use existing mailboxes and the local status command for a pilot; a full helpdesk is not included. See `docs/research.md` for the rationale and acceptance criteria.
