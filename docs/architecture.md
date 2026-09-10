# Service architecture

```mermaid
flowchart TD
  A[Student: choose topic or describe issue] --> B{Natural-language input?}
  B -->|Yes| C[Keyword matcher or private model service]
  C --> D[Validate topic IDs and ask student to confirm]
  B -->|No| D
  D --> E[Relevant context: campus and issue-specific question]
  E --> F[Approved routing rules and current directory]
  F --> G[Show recipient and explanation]
  G --> H[University information handoff]
  G --> I[Union request: description and verified reply email]
  I --> J[Review recipient and submit with idempotency key]
  J --> K[(Postgres transaction: ticket + outbox)]
  K --> L[Return saved receipt]
  K --> M[Worker claims delivery lease]
  M --> N[Email provider with stable idempotency key]
  N --> O[Record provider acceptance or retry/failure]
```

The model has no email or database tools. The API ignores no client-supplied authority: it rejects unrecognized fields, derives the requester from verified authentication, resolves the recipient itself and verifies the recipient matches the student's review.

Demo mode stops at a local draft. Live mode requires the approved directory, Supabase, authentication email setup, a verified sending provider and operational readiness. The diagram's university handoff is guidance; it does not automatically share a student's message outside the union.
