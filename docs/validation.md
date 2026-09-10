# Validation record

Validation performed on 10 September 2026. All student messages and contact details used in tests were synthetic. No external email or OTP was sent.

## Automated code tests

35 Node tests pass. They cover Hebrew/English keyword routing, unknown and ambiguous topics, approved and expired directories, recipient changes, duplicate submissions, ownership checks, CSRF, input limits, model output validation and fallback, and mail retry behaviour.

## PostgreSQL

All three migrations were applied to an isolated local PostgreSQL instance. The SQL assertions passed inside a transaction that was rolled back. Checks include atomic ticket/outbox rollback, one outbox row for repeated submission, cross-student denial, API-role privileges, rate limits, exclusive job claims, recovery after lease expiry, rejection of a stale worker acknowledgement, and provider-acceptance status.

This validates the SQL behaviour on PostgreSQL. The external Supabase Auth service, hosted PostgREST RPC deployment and organizational infrastructure were not integration-tested with live credentials.

## Browser

A fresh headless Chrome profile tested Hebrew guided routing, a payment-block university handoff, retained description when going back, request review, draft download, keyword suggestions, English switching, mobile horizontal overflow and public topic links. Screenshots were inspected at desktop and mobile sizes.

A mocked-live test exercised the approved recipient display, OTP interface, verified-email gating, failed submission, retry with the same idempotency key, receipt and status refresh. All external service responses were mocked.

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

Before live operation: approve the actual directory and routing policies; test OTP delivery and session expiry with staging accounts; validate hosted Supabase RPC permissions; test the verified email sender, transient failures and reconciliation; add delivery-event monitoring and staff operating procedures; implement privacy/retention requirements; evaluate sensitive cases and independent Hebrew examples; complete accessibility and capacity testing.
