# Student support gateway for the Hebrew University Student Union

## Recommendation

Build a short, bilingual service portal with two equivalent entry points: choosing an issue and describing it in natural language. Both should enter the same maintained routing system. Show the proposed recipient and the reason for the recommendation before collecting a full request. For university-owned problems, distinguish the office that can act from the union team that can help the student navigate or escalate the issue.

The most important asset is an approved service directory: which team handles which problem, on which campus, with what exceptions. A list of job titles and emails is the starting point, but it cannot reliably answer those questions by itself. AI should classify the problem into that directory’s taxonomy. It should never invent an email address, determine a student’s financial status, or decide whether the student deserves assistance.

Use Supabase for Postgres and email authentication, and Railway for the web service and a separate email worker. This suits a programmer already familiar with those services and keeps the first version in one repository. Railway documents persistent web services and background workers; Supabase provides passwordless email authentication. This is an architectural recommendation, not a claim that these vendors are uniquely necessary. [1](https://docs.railway.com/build-deploy), [2](https://supabase.com/docs/guides/auth/auth-email-passwordless)

The accompanying codebase implements this foundation with plain JavaScript modules, a Node server, a Supabase migration, an email adapter, and an optional self-hosted model adapter. It starts in a clearly labelled demo mode. It is a starter for further development; the launch work described below remains necessary.

## Production precedents

The evidence includes product documentation and vendor-published university case studies. Product documentation establishes supported mechanisms. Case-study results are reported by the vendor and customer, are not independently audited here, and should not be used as forecasts for the student union.

| System or deployment           | Documented approach                                                                                                                                                                                   | What to adopt here                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Jira Service Management        | Forms conditionally show or hide sections based on earlier answers. Fields can be grouped and previewed before publication.                                                                           | Ask follow-up questions only when an answer changes the destination or next action. [3](https://support.atlassian.com/jira-service-management-cloud/docs/create-or-edit-a-form/)                                                                                                                                                           |
| ServiceNow Guided Self-Service | A visual question-and-answer flow guides people to knowledge articles or catalog forms; users can revisit choices.                                                                                    | Support both an informational handoff and a request form, with an obvious way to go back. [4](https://www.servicenow.com/docs/r/employee-service-management/employee-experience-foundation/gss-guided-self-service-homepage.html)                                                                                                          |
| Zendesk intelligent triage     | Incoming messages are classified by topic, language and other attributes; classifications can drive workflows and be corrected.                                                                       | Treat classification as a suggestion with an override and record the correction separately from the original prediction. [5](https://support.zendesk.com/hc/en-us/articles/4964463770650-About-intelligent-triage), [6](https://support.zendesk.com/hc/en-us/articles/4685355428250-Viewing-intelligent-triage-classifications-in-tickets) |
| Intercom Workflows             | Data collection, branching and team assignment are composed into workflows; the first matching branch takes precedence.                                                                               | Define explicit rule priority and test overlapping rules rather than relying on incidental ordering. [7](https://www.intercom.com/help/en/articles/6611595-using-the-workflows-builder)                                                                                                                                                    |
| Western Sydney University      | Service portals consolidated inquiries that previously passed through email and forms. The case study describes plans to retire more than 32 shared addresses and estimates a 40% reduction in forms. | Consolidate the entry point and the underlying services, not just the visual appearance of the existing email directory. [8](https://www.servicenow.com/uk/customers/western-sydney-university.html)                                                                                                                                       |
| Georgian College               | The case study reports portal access to 95% of student services, including registration, finance and housing, alongside changes to service governance.                                                | Assign service owners and expectations as part of implementation. A portal alone cannot create accountability. [9](https://www.servicenow.com/uk/customers/georgian-college.html)                                                                                                                                                          |

For this union, buying an enterprise platform is worth considering if the university already operates one and will provide an appropriately isolated queue. Otherwise, a custom intake experience connected to an existing helpdesk may be easier to maintain than a new complete helpdesk. The supplied code uses email forwarding as the first delivery adapter; it does not attempt to reproduce the full agent workspaces of these products.

## Hebrew University context and limits

The union’s public Givat Ram contact page distinguishes academic coordination, academic assistance, welfare, reserve service and other functions, and provides campus-specific addresses. That is evidence that campus and service distinctions matter. It is not sufficient evidence to map every individual problem to a particular mailbox. The page reports an update on 5 June 2026. [10](https://www.aguda.org.il/articles/contact-us-givat-ram)

The university’s registration guidance states that course registration for admitted bachelor’s and master’s students becomes available after receipt of the advance payment. That is a specific prerequisite for a described population. It does not establish a universal rule that all historical balances must be zero, or that every course-registration problem should go to one central administrative office. [11](https://info.huji.ac.il/registration-process/steps)

The available study regulations also describe situations requiring departmental approval, including taking certain courses outside the student’s program. These regulations are an older, 2025 document and must be checked against the applicable academic year before being operationalized. The current public guidance supports separating financial, administrative and academic issues; it does not justify an exhaustive automated decision tree without the departments’ review. [12](https://studentsadmin.huji.ac.il/sites/default/files/minhalt/files/takanon2025.pdf)

Therefore, ask what the system reports before asking a student to interpret university bureaucracy. Examples include a payment block, inactive study registration, a particular course or approval problem, a technical error, and “I’m not sure.” Do not ask for payment receipts, years of debt, bank details or identification documents merely to select a contact.

Some routes depend on faculty or department rather than campus. In the initial code, university handoffs remain general information links; they are not falsely presented as the exact department’s contact. Add the approved department directory before enabling direct departmental handoffs. Union representatives should review examples where administration can execute a decision but a program adviser or academic committee must approve it.

## Student experience

Start with six broad, student-friendly groups: studies and academics; tuition and scholarships; wellbeing and campus life; reserve service; culture and community; and something else. These are proposed labels to test, not the union’s approved organizational structure. Keep detailed role titles out of the first choice: students know their problem better than they know the organization chart.

The desktop interface can use a row of categories or selectable cards. On mobile, use full-width choices with a short explanation. A dropdown works for a long department list, but an initial dropdown hides the available kinds of help. Do not require a multi-level hover menu or a chatbot conversation to obtain assistance.

The recommended path is: choose or describe the problem; answer the few relevant routing questions; see the destination; optionally prepare and submit a request. A student who only needs the right university contact can leave at the destination step without creating a ticket or giving an email address. A student who already typed a description should not be asked to write it again.

GOV.UK recommends documenting why each question is needed, using branching, and starting with one decision per page, then using research to determine where related questions can be combined. The practical application here is to combine a campus question and one short registration question on a compact context screen, then test whether splitting them helps mobile users. Do not manufacture ten pages to follow the pattern mechanically. [13](https://www.gov.uk/service-manual/design/form-structure)

| Information             | When to ask                                    | Purpose                                                  |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Topic                   | Always, chosen or confirmed from a suggestion  | Select the service                                       |
| Campus                  | When selecting a union recipient               | Resolve campus ownership; allow “not sure”               |
| Registration symptom    | Only for registration issues                   | Distinguish the next appropriate office                  |
| Faculty / department    | When it changes the university recipient       | Resolve the exact administrative office                  |
| Short issue description | When preparing a request                       | Tell the recipient what happened and the desired outcome |
| Reply email             | When submitting a request                      | Provide a verified return channel                        |
| Name                    | Optional unless a specific service requires it | Personalize the response                                 |
| Attachments             | Later, for a defined operational need          | Avoid unnecessary initial effort and sensitive uploads   |

A provisional usability target is a median of no more than 90 seconds from entry to submission for a straightforward case, and a faster path for contact-only guidance. This is a design target, not a published benchmark or a measured result from this prototype. Measure it with representative students before publishing any completion-time promise.

Show a plain explanation such as “You selected a payment block, so start with the tuition office to clarify that block. The union can help you navigate the process.” Avoid asserting the student owes money, demanding proof of payment, or preventing union contact because the student’s registration is inactive.

W3C recommends visible labels, logical form groups, progress information for longer flows, and feedback that helps people recover from errors. Preserve answers when users go back, allow optional steps to be skipped, and avoid unnecessary time limits. [14](https://www.w3.org/WAI/tutorials/forms/multi-page/), [15](https://www.w3.org/WAI/tutorials/forms/labels/)

Use Hebrew as the default with real RTL layout, not only right-aligned text. Keep email addresses and codes in an LTR context. Use keyboard-operable controls, visible focus, inline instructions and error messages, and test with screen readers and zoom. The starter has semantic labels, radio groups, focus management and responsive layouts, but it has not received a formal accessibility certification. W3C’s positioning guidance explicitly covers RTL label relationships. [16](https://www.w3.org/WAI/WCAG21/Techniques/general/G162)

## Routing and directory design

Maintain three distinct concepts: the student’s issue, the service responsible for it, and the current contact for that service. A representative may change each year while the service remains stable. Prefer role mailboxes over personal mailboxes where the organization can support that arrangement.

Each approved directory record should contain a stable identifier, Hebrew and English display names, the responsible role, mailbox, topic scope, campus scope, approval owner and expiry/review date. Extend it with department, degree level, fallback recipient, availability and sensitivity restrictions when these actually affect routing. Do not collect all of those dimensions from every student.

The code’s directory rejects unknown scopes and approved placeholder addresses. Only approved, unexpired entries are eligible. More specific topic/campus matches outrank broad entries. Equal-priority matches fail for correction rather than selecting a recipient arbitrarily. An approved, current general-triage contact is required before live intake starts.

When the recipient changes between preview and submission, the server requires another review. A retry of an already saved request returns the original receipt. The directory version and selected recipient are saved with the ticket so later changes do not silently rewrite its history.

For a larger taxonomy, maintain a decision table rather than hand-editing nested conditionals. A useful rule record includes conditions, outcome, priority, effective dates, explanation, authority source, approver and regression examples. Evaluate conflicting and missing rules as part of publication. Introduce a visual editor after the content model stabilizes; implementing one at the beginning adds work without solving unclear responsibility.

Shareable announcement links should contain only a stable topic slug, such as `/?topic=course-registration&lang=he`. The landing page can preselect the issue while still allowing correction. Never put a student’s free text, email, financial situation or a private ticket access token in a public campaign URL.

## Natural-language routing and model selection

Natural-language routing is a constrained classification problem. A good output is a short list of approved topic identifiers and an abstention flag. The model does not need access to live mailboxes, the student information system, payment records or general web browsing. It does not need permission to send email.

Start by comparing an explainable keyword baseline, multilingual semantic retrieval, and a small instruction model. An embedding model can retrieve service descriptions and example requests without generating prose. A classifier can handle more varied phrasing and negation, but increases serving complexity. Neither method is automatically reliable just because its model card says “multilingual.”

| Candidate                          | Evidence and characteristics                                                                                                                                                                | Recommended use                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intfloat/multilingual-e5-base`    | Published model card and multilingual E5 research; MIT licence in the model card. It is an embedding model, so it ranks text similarity rather than generating a response.                  | A strong compact retrieval baseline to evaluate on Hebrew service descriptions and examples. Apply the model’s documented query/passage formatting. [17](https://huggingface.co/intfloat/multilingual-e5-base), [18](https://arxiv.org/abs/2402.05672)    |
| Gemma 4 E2B / E4B                  | Google documents Apache 2.0 release and multilingual training. Effective parameter counts differ from total stored parameters; E4B is not simply a four-billion-parameter memory footprint. | Test a smaller Gemma deployment first if the local evaluation set is satisfactory and serving resources are limited. [19](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/), [20](https://huggingface.co/google/gemma-4-E4B-it) |
| Gemma 4 12B / 26B                  | Current Gemma documentation includes these larger variants. A `gemma4:26b` Ollama model was available locally for the supplied synthetic test.                                              | Use the installed model for development; do not assume its hardware footprint or latency is appropriate for public deployment. [21](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemma-4-12b/)                           |
| `Qwen/Qwen3-4B`                    | Published Apache 2.0 model card, 4.0B parameters, multilingual support and configurable thinking. This is a compact comparison candidate, not a claim that it is the latest Qwen release.   | Evaluate as a second instruction-model baseline using the same examples and serving budget. [22](https://huggingface.co/Qwen/Qwen3-4B)                                                                                                                    |
| Commercial helpdesk classification | Zendesk’s product-specific language table includes Hebrew for topic and sentiment classification. That does not imply every AI feature supports Hebrew identically.                         | Consider when an existing helpdesk contract removes substantial integration work; verify feature entitlements and Hebrew quality in a trial. [23](https://support.zendesk.com/hc/en-us/articles/4408821324826-Zendesk-language-support-by-product)        |

A sensible sequence is to establish the keyword baseline, evaluate multilingual E5 on an approved catalog, and compare Gemma against the same labelled examples. Choose the simplest option that meets routing quality and response-time targets. Fine-tuning is premature before there is a stable taxonomy and enough reviewed examples to distinguish model mistakes from unclear ownership.

The code supports both an OpenAI-compatible chat endpoint and Ollama’s native chat API. The native path requests a JSON schema and disables thinking for the tested Gemma configuration. All returned IDs are validated, duplicate IDs are normalized, unknown IDs are rejected, and failures fall back to keywords. Ollama documents schema-based structured outputs and the native `think` setting. Server compatibility still needs validation for a different model or host. [24](https://docs.ollama.com/capabilities/structured-outputs), [25](https://docs.ollama.com/api/chat)

The model’s self-reported confidence is not a calibrated probability. The starter deliberately does not display percentages. In a future evaluated system, use measured acceptance thresholds, an abstention policy and the gap between plausible candidates. A high aggregate score is insufficient if the model misroutes sensitive cases or consistently fails on a particular language or campus.

The included evaluation file contains 23 authored synthetic examples covering Hebrew, English, mixed language, unclear requests, negation, multiple issues and attempted instruction injection. It is useful for checking the integration and reproducing failures. It is not a held-out production benchmark, and the examples overlap the design of the taxonomy. Exact run results are recorded in the evaluation JSON artifacts and the validation note.

The local experiment showed a real integration risk: the initial OpenAI-compatible invocation did not produce validated predictions under the chosen output budget, while the native structured-output configuration did. A system that only reports its final topic would have concealed this by counting fallback results as AI successes. The evaluator records the method and fallback status for every example.

Before a pilot, assemble a de-identified, independently labelled evaluation set from real inquiries with permission to use them. Include common and rare topics, typos, slang, Hebrew prefixes, English, mixed scripts, negation, multiple departments and requests that should remain unclassified. Have a second person adjudicate ambiguous ownership. Reserve an untouched test split. Measure top-one correctness, coverage within the suggestions, unnecessary suggestions, abstention quality, per-topic recall, sensitive-route errors and p95 latency under expected concurrency.

OWASP describes prompt injection as a risk when untrusted text is treated as instructions, and recommends least privilege and output validation among the defenses. The architectural control here is stronger than wording alone: the model has no action tools and its output cannot create a new recipient. Basic email/number redaction reduces obvious identifiers, but it is not complete anonymization and does not remove all sensitive narrative details. [26](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

## Backend and delivery

The recommended service boundary is a single web application and API, one Postgres database, and an independent delivery worker. Keep model inference behind a server-side adapter. For a small catalog, no separate vector database is needed initially; an embedding experiment can rank a small in-memory catalog or later use Postgres vector search if justified.

The database transaction inserts the ticket and an outbox row together. The request is accepted when that transaction commits. The worker separately claims an outbox job, attempts delivery and records its outcome. This avoids the dual-write problem where a ticket is saved but its notification disappears, or a notification is sent for a ticket that never committed. AWS documents the transactional outbox pattern and the need to handle duplicates. [27](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

The starter uses job leases, fenced acknowledgements and bounded exponential retries. It passes the same provider idempotency key and frozen payload on retries. Resend retains idempotency keys for 24 hours; therefore the worker stops automatic retries before that boundary after an uncertain initial attempt. An operator must reconcile a failed or expired job instead of blindly creating a new key and risking a duplicate message. [28](https://resend.com/docs/dashboard/emails/idempotency-keys)

| State             | What it means to the student                               | What it does not establish                           |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Received          | The request was saved                                      | The recipient has read it                            |
| Email queued      | Delivery work is pending or retrying                       | The recipient’s server has accepted it               |
| Provider accepted | The email service accepted the send                        | Delivery to an inbox, reading or resolution          |
| Email failed      | Delivery needs operator attention; the ticket still exists | The student should submit duplicate requests         |
| Resolved          | A responsible person has recorded resolution               | Something that can be inferred from sending an email |

Delivery events and bounces are separate from API acceptance. For example, SES distinguishes sending, delivery to a recipient’s mail server, bounces, complaints and delays. The starter does not implement signed provider webhooks or inbox read tracking and does not claim to do so. Add delivery-event processing or use a helpdesk integration before promising richer delivery status. [29](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html)

Staff can initially reply to the verified student address from the role mailbox. That keeps adoption simple, but replies made there do not automatically update this database. A subsequent phase should connect an existing helpdesk or implement a staff workspace with assignment, transfers, internal notes, reply ingestion and explicit closure. Do not put “waiting for student” or “resolved” on the portal unless that state comes from an actual recorded action.

## Authentication, privacy and operations

Allow anonymous browsing and topic selection. Verify the reply address only when a student decides to send. The live starter uses Supabase email OTP and an HttpOnly, Secure, SameSite cookie; ticket ownership comes from Supabase’s verified user response. The API never accepts a requester ID or destination email supplied by the browser. Supabase’s OTP method sends a magic link by default unless the email template is configured to include the token, so that template configuration is part of setup. [30](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [31](https://supabase.com/docs/reference/javascript/auth-verifyotp)

The migration enables row-level security and revokes direct table and administrative RPC access from public browser roles. The server’s service credential remains server-side. Because that credential is privileged, ownership checks must remain explicit in every API and RPC path. The starter includes tests that a different student cannot retrieve a ticket and that browser roles cannot execute the administrative creation function.

Use separate staging and production projects, restricted administrator access, managed secrets, backups and restore drills. Do not put request text into URLs, analytics events, error messages or model telemetry. Rate-limit OTP attempts and intake, and add edge-level abuse controls before public exposure; the code deliberately does not trust arbitrary forwarded-IP headers. Global limits protect costs but need tuning so many students behind a university NAT are not blocked together.

The union should decide and document the legal basis, purpose, recipients and retention period for this service with the responsible privacy adviser. Israel’s Amendment 13 entered into force on 14 August 2025, and the Privacy Protection Authority explains that exemption from database registration does not remove other obligations. This project should be reviewed under the applicable Israeli framework rather than assuming GDPR is the only relevant law. This report is a product and engineering assessment, not a determination of the union’s legal obligations. [32](https://main.knesset.gov.il/Activity/Legislation/Laws/pages/lawbill.aspx?lawitemid=2167975&t=lawsuggestionssearch), [33](https://www.gov.il/he/pages/tikun13_qa?chapterIndex=6)

For disability, harassment, health or other sensitive disclosures, design dedicated restricted routes before enabling broad automatic forwarding. A fallback triage team is useful, but should not automatically receive every category of sensitive report. The initial general categories are illustrative; operational owners must decide where a restricted service or direct external contact is required. Do not train on these messages by default.

A privacy notice, approved retention and deletion procedures, monitored failed-mail queue, directory review process, accessibility review and agreed staff coverage are launch requirements. The supplied consent text explains the immediate sharing action, but it is not a complete organizational privacy notice. Email copies are additional retained records and must be considered alongside the database.

## Implementation sequence and acceptance criteria

First, run a routing workshop with representatives of the main campuses. For each frequent issue, record the first responsible university office, the union support owner, exceptions, required facts and escalation path. Review anonymized examples, not only abstract role descriptions. Give one operational owner responsibility for maintaining the directory and another person responsibility for approving changes.

Next, pilot guided routing for a small set of common issues and one campus. Observe students using mobile devices, including students unfamiliar with union roles. Track abandonment by step, requests sent to the wrong team, time to the first useful response and requests that require the student to repeat information. Do not treat a reduction in submitted tickets alone as success; students may simply be giving up.

Then enable natural-language suggestions in a limited pilot after offline evaluation. Compare the suggested topic with the student’s confirmed topic and the final staff-owned topic. Keep those as separate fields. A student accepting a suggestion is weak evidence of correctness; the staff outcome is stronger, though it too requires review.

| Release gate               | Evidence required                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Routing                    | Every enabled route has an approved owner, current contact, explanation and fallback; overlaps and gaps are tested     |
| Student effort             | Representative students can complete common paths; unnecessary questions are removed based on observation              |
| Ticket reliability         | Commit/outbox atomicity, duplicate submission, crash recovery and delivery failure are tested                          |
| Identity and access        | Ownership checks, staff authorization and session expiry are tested without exposing private tickets                   |
| Language and accessibility | Hebrew, English, RTL, keyboard, zoom, mobile and screen-reader testing                                                 |
| AI suggestions             | Independent labelled examples, subgroup results, abstention and invalid-output behaviour, measured concurrency/latency |
| Operations                 | Named monitoring owner, backup/restore practice, delivery-failure runbook, support schedule and directory renewal      |
| Privacy                    | Organizational notice, retention, access policy, model processing terms and sensitive-topic handling approved          |

Track completion rate with a denominator that includes abandoned attempts, median and p90 form time, first-destination acceptance, reassignment rate, time to first meaningful response, aged unassigned requests, email failures and student-rated routing usefulness. Record operational metadata without storing the student’s full text in analytics. Segment enough to detect poor service across campuses and languages without reporting identifying small groups.

Budget by the actual operating model: database/authentication, web service, worker, email volume, observability, and model-serving time or hardware. Open weights remove a licence charge in some cases; they do not remove inference cost or maintenance. A continuously running 26B model is unlikely to be the first economical choice for sparse traffic. Obtain current quotes and run a concurrency test once the expected request volume and hardware are known.

## What the codebase contains

Implemented: a responsive Hebrew/English student interface; guided topic routing; preserved descriptions; topic links; an explicit general-help path; keyword suggestions; optional validated model classification; reviewed recipient binding; OTP API integration; authenticated ticket creation and lookup; Postgres transactional outbox; an idempotent email worker; tests and a synthetic model evaluator.

Not yet implemented: a complete staff case-management interface; staff reply ingestion; signed delivery webhooks; automated retention/deletion; organizational SSO; fine-grained sensitive-service access policies; a directory editor; exact university department resolution; model accuracy certification; production observability and a full accessibility audit. External Supabase, authentication and email delivery require credentials and staging verification. No real student messages were sent as part of this build.

The next input needed is the role list plus responsibility examples. The supplied CSV template adds the scope, owner and review information that turns that list into an operational directory. Keep live intake disabled until the directory and privacy/operational setup are approved.

## Sources

Sources were accessed on 10 September 2026. Documentation is generally undated and may change. Dates below are publication or update dates only when explicitly available; none of the vendor case studies are independent controlled experiments.

1. Railway. [Build & Deploy](https://docs.railway.com/build-deploy). Current documentation; accessed 10 September 2026.
2. Supabase. [Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless). Current documentation; accessed 10 September 2026.
3. Atlassian. [Create or edit a form](https://support.atlassian.com/jira-service-management-cloud/docs/create-or-edit-a-form/). Current Jira Service Management Cloud documentation.
4. ServiceNow. [Use Guided Self-Service](https://www.servicenow.com/docs/r/employee-service-management/employee-experience-foundation/gss-guided-self-service-homepage.html). Australia release; updated 12 March 2026.
5. Zendesk. [About intelligent triage](https://support.zendesk.com/hc/en-us/articles/4964463770650-About-intelligent-triage). Updated 7 July 2026.
6. Zendesk. [Viewing intelligent triage classifications in tickets](https://support.zendesk.com/hc/en-us/articles/4685355428250-Viewing-intelligent-triage-classifications-in-tickets). Current product documentation.
7. Intercom. [Using the Workflows builder](https://www.intercom.com/help/en/articles/6611595-using-the-workflows-builder). Current product documentation.
8. ServiceNow. [Western Sydney University customer story](https://www.servicenow.com/uk/customers/western-sydney-university.html). Undated vendor case study.
9. ServiceNow. [Georgian College customer story](https://www.servicenow.com/uk/customers/georgian-college.html). Undated vendor case study.
10. Hebrew University Student Union. [Givat Ram contacts](https://www.aguda.org.il/articles/contact-us-givat-ram). Page updated 5 June 2026.
11. Hebrew University. [Registration process: next steps](https://info.huji.ac.il/registration-process/steps). Current public guidance.
12. Hebrew University, Student Administration. [Study regulations, 2025](https://studentsadmin.huji.ac.il/sites/default/files/minhalt/files/takanon2025.pdf). Older regulation source; academic-year applicability requires review.
13. GOV.UK Service Manual. [Structuring forms](https://www.gov.uk/service-manual/design/form-structure). Current design guidance; originally published 2016.
14. W3C WAI. [Multi-page Forms](https://www.w3.org/WAI/tutorials/forms/multi-page/). Updated 27 July 2019.
15. W3C WAI. [Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/). Current forms tutorial.
16. W3C. [G162: Positioning labels to maximize predictability of relationships](https://www.w3.org/WAI/WCAG21/Techniques/general/G162). Current technique documentation.
17. Liang Wang / intfloat. [multilingual-e5-base model card](https://huggingface.co/intfloat/multilingual-e5-base). Model source and licence.
18. Liang Wang et al. [Multilingual E5 Text Embeddings: A Technical Report](https://arxiv.org/abs/2402.05672). 8 February 2024.
19. Google DeepMind. [Gemma 4: Byte for byte, the most capable open models](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/). 2 April 2026.
20. Google DeepMind. [gemma-4-E4B-it model card](https://huggingface.co/google/gemma-4-E4B-it). Current model architecture and licence information.
21. Google DeepMind. [Introducing Gemma 4 12B](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemma-4-12b/). 3 June 2026.
22. Qwen. [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B). Model configuration, licence and deployment guidance.
23. Zendesk. [Language support by product](https://support.zendesk.com/hc/en-us/articles/4408821324826-Zendesk-language-support-by-product). Current feature-specific language table.
24. Ollama. [Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs). Current documentation.
25. Ollama. [Generate a chat message](https://docs.ollama.com/api/chat). Native API schema.
26. OWASP. [LLM Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html). Current security guidance.
27. AWS. [Transactional outbox pattern](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html). Prescriptive Guidance.
28. Resend. [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys). Current provider behaviour and 24-hour horizon.
29. AWS. [Monitor email sending using Amazon SES event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html). Delivery-event definitions.
30. Supabase. [JavaScript: signInWithOtp](https://supabase.com/docs/reference/javascript/auth-signinwithotp). Token versus link configuration.
31. Supabase. [JavaScript: verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp). Email OTP verification.
32. Knesset. [Privacy Protection Law Amendment 13](https://main.knesset.gov.il/Activity/Legislation/Laws/pages/lawbill.aspx?lawitemid=2167975&t=lawsuggestionssearch). Enacted 14 August 2024; effective 14 August 2025.
33. Israel Privacy Protection Authority. [Amendment 13 questions and answers](https://www.gov.il/he/pages/tikun13_qa?chapterIndex=6). Published 14 August 2025; updated 18 August 2025.
