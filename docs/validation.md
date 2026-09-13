# Validation record

Updated implementation validation: 13 September 2026. The model experiment below was performed on 10 September 2026 and was not rerun for this change. All student messages and contact details used in tests were synthetic. No external email or OTP was sent.

## Automated code tests

46 Node tests pass. New checks include the independent Svix signature vector, tampered/stale/future webhook signatures, minimal event payloads, real local HTTP routing and asset caching, readiness, current Supabase API-key headers, expired-code/session error mapping, policy-version replay and shutdown during an active send. They cover Hebrew/English keyword routing, unknown and ambiguous topics, approved and expired directories, recipient changes, duplicate submissions, ownership checks, CSRF, input limits, model output validation and fallback, and mail retry behaviour.

## PostgreSQL

All four migrations were applied to fresh disposable PostgreSQL 16 instances on 13 September. The SQL assertions passed inside a transaction that was rolled back. Checks include atomic ticket/outbox rollback, one outbox row for repeated submission, cross-student denial, API-role privileges, rate limits, exclusive job claims, recovery after lease expiry, rejection of a stale worker acknowledgement, provider-acceptance status, duplicate/out-of-order/early delivery notifications, role restrictions on operator functions, attributed handling-state updates, cascade deletion and protection of active sends during cleanup.

This validates the SQL behaviour on PostgreSQL. The external Supabase Auth service, hosted PostgREST RPC deployment and organizational infrastructure were not integration-tested with live credentials.

## Browser

A fresh headless Chrome profile tested Hebrew guided routing, a payment-block university handoff, retained description when going back, request review, draft download, keyword suggestions, English switching, mobile horizontal overflow and public topic links. Screenshots were inspected at desktop and mobile sizes.

The updated mocked-live test exercised incorrect-code recovery, expired-session re-verification without resubmitting a ticket, reviewed notice versions, confirmed delivery states, sign-out, mobile receipt layout, and the approved recipient display, OTP interface, verified-email gating, failed submission, retry with the same idempotency key, receipt and status refresh. All external service responses were mocked.

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

## Outstanding external validation

Before live operation: set up the accounts and sending domain; review the provisional receiving arrangement and privacy policy; validate real Supabase Auth, hosted RPCs, SMTP delivery and signed provider notifications in staging; assign staff and alert ownership; configure mailbox/Auth/backup data retention separately; test sensitive handling procedures, accessibility and representative hosted capacity. Exact university department contacts and independent Hebrew model examples still require external input. No real student data, live provider credentials or externally delivered messages were used.

## Performance smoke check

The reproducible `npm run test:performance` check measures 100 local `/api/config` requests at concurrency 10 and records compressed page/JS/CSS sizes in `artifacts/performance-local.json`. The final 13 September run measured p50 1.46 ms and p95 10.19 ms, with approximately 19.5 kB of compressed core assets. Timings exclude real network latency, Supabase Auth/database operations, mail and model inference. This is a local overhead check, not a hosted capacity benchmark or a page-load guarantee.

Static resources use representation-specific ETags and are served from precompressed memory buffers. The HTTP tests check cache revalidation, compression, HEAD behavior, private-path exclusion and no-store privacy responses.

## Directory provenance

The one-page user-supplied PDF was visually compared with extracted table rows. It contained 16 mailboxes. Role titles and addresses were copied to `config/roles-source.json`; staff names and the source PDF were not added to Git. Responsibility mapping is explicitly provisional, as requested, and is not proof that every role has agreed to receive those issue types. The user confirmed the social-media mailbox is monitored despite the vacancy marker in the source.
