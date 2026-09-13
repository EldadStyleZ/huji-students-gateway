# Operating the pilot

One Node service hosts static pages, the same-origin API, the email sender and maintenance. PostgreSQL remains the durable queue. All operator RPCs are inaccessible to browser roles. There is no internet-facing admin dashboard.

## Daily checks

On a trusted operator machine, put `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the ignored `.env`. Run:

```sh
npm run ops -- status
npm run ops -- cases
```

The status command reports aggregate counts, pending age and last cleanup. Cases returns the oldest 100 unresolved references and categories, without descriptions or student email addresses. Inspect failures through authorized database/provider tools when necessary. Alert on `needsAttention > 0`, pending age over five minutes, or a missing/stale `lastPrunedAt`. The app logs aggregate `operator_attention` changes; these logs do not themselves deliver an alert to a person. Railway deployment healthchecks are not continuous queue monitoring.

For a small pilot, assign a named operator to check daily and respond to platform failure notifications. Before broader rollout, connect these existing logs/status checks to the union's monitoring process. Avoid adding monitoring scripts to the student's browser.

## Staff handling

Staff reply from their ordinary mailbox to the verified student's `Reply-To`. The email subject and body contain the immutable request reference. Replies are not automatically synchronized back to the gateway.

A trusted operator can record status after checking with the receiving team:

```sh
# OPERATOR_NAME must identify the administrator, set privately in .env.
npm run ops -- set-status REQUEST_UUID in_progress
npm run ops -- set-status REQUEST_UUID resolved
```

The database records the operator label and status event. The command uses a privileged server credential, so give it only to administrators. It is a pilot administration workflow, not role-scoped staff authentication.

## Failed or uncertain delivery

`provider_accepted` confirms API acceptance. `delivered` confirms delivery to the recipient's mail server. Neither proves reading or resolution. A bounce, complaint or permanent failure needs human attention.

For temporary provider errors, retries use the same frozen payload and idempotency key. A crashed worker's lease is recoverable. After an ambiguous send, reconcile with Resend using the provider ID and the `gateway/OUTBOX_UUID` idempotency key before doing anything manually. Do not create a new ticket or delivery key to bypass a failure. No automatic resend is implemented for permanent failures or bounces.

Database leases allow multiple instances, but the first pilot uses one. `BACKGROUND_WORKER=false` is an advanced switch for a separately operated worker; the default deployment readiness requires its own running background loop. Do not use that switch with the supplied single-service Railway healthcheck.

## Retention and deletion

`config/service.json` specifies the reviewed number of days from submission. Once per hour, the background loop deletes up to 500 expired requests from the active database, including linked payloads and events. It skips an actively leased send and retries at the next cleanup. Expired rate-limit buckets and unrelated old webhook metadata are also removed. At pilot volume the batch should clear within one pass; monitor cleanup/backlog before scaling. Cleanup requires a running service and healthy database.

For an individual verified deletion request, look up its reference in an authorized tool. Preview the record and confirm the student's authority before using:

```sh
npm run ops -- erase REQUEST_UUID --confirm-ticket=REQUEST_UUID
```

This is irreversible for the active database. It refuses deletion while a delivery lease is active. It does not retract sent mail, delete Supabase Auth users, purge backups or remove provider logs. Handle those separately under the union's chosen policy. Use Supabase's supported user deletion workflow only after identifying the correct account and considering its other requests. Apply mailbox retention in the union's email system. Document backup expiry and prevent restored backups from reintroducing data that must remain deleted.

## Credentials and access

Prefer Supabase's scoped-to-project secret key, never a browser-exposed value. The current API runs server-only privileged RPCs; maintain a dedicated project to limit the consequences of a server-key compromise. Rotate Railway/Supabase/Resend keys through their dashboards. Use separate domain-scoped sending keys for auth and request forwarding. The webhook signing secret is distinct from either API key.

No credentials, message contents, cookies or student email addresses are written to application logs. Hosting/provider logs are separate and require an operator policy. No runtime npm dependencies are installed in the application image. Development dependencies are lockfile-pinned; CI actions are commit-pinned.

## Availability and speed

`/healthz` reports process liveness. `/readyz` fails until the background loop confirms the expected schema and can operate, and becomes unavailable during shutdown or after prolonged dependency failure. It does not test mailbox delivery or Supabase Auth end-to-end. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=35`, keep the service awake, and place app/database near each other.

Static files are read and compressed at startup, served from memory and revalidated with representation-specific ETags. Student/API/privacy responses use `no-store`. Manual selection and keyword suggestions require no model inference. Recipient resolution requires no database call. OTP and ticket creation deliberately use durable rate limits and verified authentication.

The HTTP server bounds body size, request duration, simultaneous requests and process-wide bursts without trusting forwarded-IP headers. Durable limits protect email addresses, verified accounts and global send/model budgets. These limits bound resource use; they cannot guarantee availability against a distributed denial of service or prevent abuse of a directly reachable Auth service. Review Supabase's native auth limits before broad exposure; if observed abuse justifies CAPTCHA, add it deliberately and measure the student friction.
