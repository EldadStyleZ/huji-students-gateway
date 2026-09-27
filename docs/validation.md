# Validation record

Updated implementation validation: 27 September 2026. The model experiment below was performed on 10 September 2026 and was not rerun for this change. Automated tests use synthetic messages and contacts; they do not send external email or OTP.

## Automated code tests

53 Node tests pass. Staging checks cover unchanged production configuration, test-only routing and authentication, mismatched verified identities, renewed recipient review and rejection of queued messages with other recipients or CC/BCC. New checks include the independent Svix signature vector, tampered/stale/future webhook signatures, minimal event payloads, real local HTTP routing and asset caching, readiness, current Supabase API-key headers, expired-code/session error mapping, policy-version replay and shutdown during an active send. They cover Hebrew/English keyword routing, unknown and ambiguous topics, approved and expired directories, recipient changes, duplicate submissions, ownership checks, CSRF, input limits, model output validation and fallback, and mail retry behaviour.

## PostgreSQL

All four migrations were applied to fresh disposable PostgreSQL 16 instances on 13 and 27 September. The SQL assertions passed inside a transaction that was rolled back. Checks include atomic ticket/outbox rollback, one outbox row for repeated submission, cross-student denial, API-role privileges, rate limits, exclusive job claims, recovery after lease expiry, rejection of a stale worker acknowledgement, provider-acceptance status, duplicate/out-of-order/early delivery notifications, role restrictions on operator functions, attributed handling-state updates, cascade deletion and protection of active sends during cleanup.

The four migrations were also applied to the designated empty hosted Supabase staging project on 27 September. A read-only operations query confirmed schema version 4 and an empty queue. Catalog checks confirmed RLS on all six gateway tables, service-role table access and no anonymous/authenticated table or function access. The six informational no-policy advisor findings are intentional for this server-only design; see [staging setup](staging.md). The external Auth, PostgREST, SMTP and application deployment still require an end-to-end integration test.

## Browser

A fresh headless Chrome profile tested Hebrew guided routing, a payment-block university handoff, retained description when going back, request review, draft download, keyword suggestions, English switching, mobile horizontal overflow and public topic links. Screenshots were inspected at desktop and mobile sizes.

The updated mocked-live test exercised incorrect-code recovery, expired-session re-verification without resubmitting a ticket, reviewed notice versions, confirmed delivery states, sign-out, mobile receipt layout, and the approved recipient display, OTP interface, verified-email gating, failed submission, retry with the same idempotency key, receipt and status refresh. All external service responses were mocked. The test was rerun on 27 September and also verified the staging notice in Hebrew and English at mobile width.

A separate real local model test used the AI-enabled preview and a synthetic Hebrew housing issue. The interface displayed a validated Gemma topic suggestion. The in-app browser integration could not initialize; these checks used a separate local browser process.

These checks are not a complete accessibility audit, penetration test or load test.

## Synthetic model experiment

Configuration: locally installed Ollama `gemma4:26b`, reported installed ID `5571076f3d70`, native chat API, `think:false`, JSON-schema output, 4,096-token context, 180-token generation budget, temperature 0. A 60-second timeout was used for evaluation; the application defaults to 8 seconds. The model was already available and had been exercised before the final run, so these timings do not establish cold-start performance.

| Measure                                        |        Keyword baseline | Final Gemma configuration |
| ---------------------------------------------- | ----------------------: | ------------------------: |
| Synthetic cases                                |                      23 |                        23 |
| Expected first outcome, including abstention   |                 21 / 23 |                   23 / 23 |
| All expected topics covered within suggestions |                 21 / 23 |                   23 / 23 |
| Valid model responses                          |          Not applicable |                   23 / 23 |
| Unnecessary additional topics                  | See raw baseline output |                         3 |
| Median elapsed time                            |         Rounded to 0 ms |                    751 ms |
| p95 elapsed time                               |         Rounded to 0 ms |                    894 ms |

The 23 examples were authored for this project and overlap the taxonomy design. They are not a representative random sample, an independent test split, or evidence of 100% production accuracy. Several prompting/validation adjustments were made using this set. Hold out fresh real-world examples before selecting a production model.

Gemma sometimes repeated the same valid ID; the adapter now normalizes duplicates. Three cases still included an extra service that was not required by the expected labels. Unknown IDs and malformed output are rejected, and the evaluator distinguishes model results from keyword fallbacks.

Raw results: `artifacts/evaluation-model.json`, `artifacts/evaluation-keywords.json`. Reproduce with `npm run evaluate` and the environment settings documented in the README. Different model versions, hardware, quantizations, concurrency and server configurations may change both quality and latency.

## Email provider connection

On 27 September 2026, one explicitly requested synthetic connection test was sent through the authenticated Resend MCP from its built-in test sender to the account owner. Resend reported `delivered`, and the tester confirmed receiving the message. No student request or private student information was included. This verifies the provider connection only: it does not test Supabase SMTP, the application outbox, signed webhooks or the full sign-in/submission flow.

## Hosted staging checks

After the operator supplied the missing Supabase server secret, Railway reported a successful deployment on 27 September 2026. `/healthz` and `/readyz` returned HTTP 200. `/api/config` confirmed staging enabled and AI disabled. The hosted database operations check reported schema version 4, no queued requests and no cases needing attention.

Live HTTP checks rejected an anonymous session (401), a cross-origin code request (403), a non-staging email address (403), and an unsigned delivery webhook (401). Private environment and configuration paths returned 404. The home and privacy pages returned 200 with the configured security headers. Hebrew course-registration text and English reserve-duty text produced keyword suggestions; the latter also suggested an exam-related topic, so this does not establish routing accuracy for arbitrary text.

The browser's Hebrew course-registration flow showed tuition administration guidance for a payment block, displayed the restricted test recipient and reached the sign-in code screen. The initial code request used the built-in sender. After custom SMTP was saved, a fresh code email appeared in Resend with status `delivered` on 28 September (local time). Dashboard checks confirmed the two bilingual code templates, exact Site URL, email confirmation enabled and 600-second expiration for eight-digit codes.

The real browser test exposed a missing-code defect: `setBusy(true)` disabled the input before `FormData` read it. The previous API mock accepted any verification payload, which hid the problem. A new assertion first reproduced `token: null`, and the corrected handler passed the browser flow with checks of the actual six- and eight-digit payloads, invalid-code recovery and reauthentication without resubmission. All 53 Node tests passed, as did the full [GitHub checks for the fix](https://github.com/EldadStyleZ/huji-students-gateway/actions/runs/36358645589), including the PostgreSQL and browser checks.

After deployment, the actual browser verified a fresh eight-digit code. A Hebrew course-registration request and an English reserve-service request selected through free-text suggestions were then submitted using invented issue descriptions. Both requests were saved, forwarded and reported delivered by Resend. Each had one outbox row, one send attempt and one signed delivery callback stored in Supabase. Refreshing both browser receipts displayed successful delivery. The final operations query reported zero queued work, zero cases needing attention and two synthetic received cases. No real union role mailbox received a test. See [staging status](staging.md).

## Outstanding external validation

Before real student intake: configure a sending domain for recipients beyond the restricted tester; review the provisional receiving arrangement and privacy policy; assign staff and alert ownership; configure mailbox/Auth/backup data retention separately; test sensitive handling procedures, accessibility, hosted failure recovery and representative hosted capacity. Exact university department contacts and independent Hebrew model examples still require external input. No real student issue details were used. Automated code/browser suites use mocked providers; the successful hosted sign-in/submission/delivery checks above are separately identified and cover the normal path with two synthetic requests. They do not establish arbitrary-text routing accuracy, staff handling, delivery under failures or production capacity.

## Performance smoke check

The reproducible `npm run test:performance` check measures 100 local `/api/config` requests at concurrency 10 and records compressed page/JS/CSS sizes in `artifacts/performance-local.json`. The final 13 September run measured p50 1.46 ms and p95 10.19 ms, with approximately 19.5 kB of compressed core assets. Timings exclude real network latency, Supabase Auth/database operations, mail and model inference. This is a local overhead check, not a hosted capacity benchmark or a page-load guarantee.

Static resources use representation-specific ETags and are served from precompressed memory buffers. The HTTP tests check cache revalidation, compression, HEAD behavior, private-path exclusion and no-store privacy responses.

## Directory provenance

The one-page user-supplied PDF was visually compared with extracted table rows. It contained 16 mailboxes. Role titles and addresses were copied to `config/roles-source.json`; staff names and the source PDF were not added to Git. Responsibility mapping is explicitly provisional, as requested, and is not proof that every role has agreed to receive those issue types. The user confirmed the social-media mailbox is monitored despite the vacancy marker in the source.
