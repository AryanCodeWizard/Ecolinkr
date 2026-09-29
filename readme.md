# EcoLinkr: Full Architecture & Phase-Wise Development Plan

*MERN microservices + AI · 16-week MVP · built for a small team /
capstone*

------------------------------------------------------------------------

## 0. How to Read This Plan

Every phase lists: **Objective · Architecture state at end of phase ·
Features · Technical work · Database work · APIs · UI screens · AI work
· Testing · Deliverables · Definition of Done (DoD)**. Phases overlap
(see the Gantt chart in §12), so read \"end of phase\" as \"when this
phase\'s gate is passed\".

### 0.1 Service map: full design vs capstone configuration

  Full design (9 services + gateway)   Capstone configuration (6)                        Introduced in
  ------------------------------------ ------------------------------------------------- --------------------------------------------
  gateway                              gateway                                           Phase 2
  auth-service                         identity-service (auth + user)                    Phase 2
  user-service                         identity-service                                  Phase 2 (profiles), Phase 4 (verification)
  catalog-service                      catalog-service                                   Phase 3
  media-service                        module inside marketplace-service                 Phase 3
  marketplace-service                  marketplace-service                               Phase 3 (listings), Phase 4 (offers)
  notification-service                 module inside transaction-service                 Phase 4
  transaction-service                  transaction-service                               Phase 5
  ai-service                           ai-service                                        Phase 3 (v0), grows through Phase 6
  admin-analytics-service              module inside identity-service + reports script   Phase 6

**Rule:** build the capstone configuration first; split a module into
its own service only when it has a different scaling need, a different
release cadence, or a different owner. Keep the module boundary
(folders + interfaces) identical so splitting later is mechanical.

### 0.2 Architecture evolution at a glance

``` mermaid
flowchart LR
  P2["Phase 2<br/>gateway<br/>auth / user<br/>RabbitMQ, Redis, Mongo<br/>CI/CD"] --> P3["Phase 3<br/>catalog<br/>media<br/>marketplace (listings)<br/>ai-service v0"]
  P3 --> P4["Phase 4<br/>marketplace (offers, matching)<br/>notification<br/>recycler verification<br/>AI ranking + fairness"]
  P4 --> P5["Phase 5<br/>transaction-service<br/>saga, GPS/photo verification<br/>earnings ledger<br/>AI risk score"]
  P5 --> P6["Phase 6<br/>admin-analytics<br/>audit, reports<br/>AI insights"]
  P6 --> P8["Phase 8-9<br/>hardening<br/>prod infra<br/>monitoring, backups"]
```

  End of phase   Services running                          Infra added                                                Events live
  -------------- ----------------------------------------- ---------------------------------------------------------- ---------------------------------------------------------
  2              gateway, auth, user                       Docker Compose, MongoDB, RabbitMQ, Redis, CI/CD, staging   `user.registered`
  3              \+ catalog, media, marketplace, ai (v0)   S3/Cloudinary, presigned uploads, Maps                     `media.processed`, `price.updated`, `listing.published`
  4              \+ notification                           FCM, SMS OTP provider, geo indexes, job scheduler          `recycler.verified`, `offer.created`, `offer.accepted`
  5              \+ transaction                            Saga + DLQs, PDF receipts                                  `transaction.*`, `handover.verified`, `ai.risk.flagged`
  6              \+ admin-analytics                        Aggregation jobs, report export                            consumes all
  8              hardened set                              WAF, secrets rotation, load-test harness, backup drills    unchanged
  9              production                                Prod VMs/containers, monitoring, alerting, Play Store      unchanged

### 0.3 Stable technology decisions (why)

  Decision                                                    Why
  ----------------------------------------------------------- ------------------------------------------------------------------------------
  Node + Express + TypeScript everywhere                      One language, shared Zod contracts, fastest for a small team
  MongoDB (DB per service, one Atlas cluster)                 Flexible schema, native geo queries, ownership boundaries without extra cost
  RabbitMQ                                                    Reliable async events, retries, dead-letter queues; Kafka would be overkill
  Redis                                                       Rate limits, caching, BullMQ job queue
  React Native (Expo) + SQLite                                Offline-first collector app, camera and GPS
  React + Vite + Tailwind                                     Admin and recycler portals
  Docker Compose → managed containers                         Cheap now; clear path to ECS/Kubernetes later
  AI behind a provider-adapter + advisory-only outputs        Swap models without changing services; humans confirm decisions
  Cash settlement in MVP, `PaymentProvider` interface ready   Avoids payment KYC and compliance overhead during validation

------------------------------------------------------------------------

# PHASE 0: Research & Validation (Weeks 1--2)

**Objective:** confirm the problem, real prices, and willingness to use
the platform; gather data needed later for AI.

**Architecture state at end:** none (decisions recorded as Architecture
Decision Records, ADRs).

**Features:** none.

**Technical work**

-   Create GitHub org/monorepo, project board, branching rules, ADR
    folder (`docs/adr`).
-   Create accounts: MongoDB Atlas, CloudAMQP, S3/Cloudinary, Firebase,
    Mapbox/Google Maps, SMS/OTP provider, Sentry.
-   Write a **data collection plan for AI**: photo protocol (angles,
    lighting, background), label list (categories), consent note, target
    300--500 labelled photos.

**Database work:** price sheet (CSV) per category and unit; category
taxonomy with hazard levels; region list.

**APIs:** none.

**UI screens:** paper sketches of the add-e-waste and offer screens.

**AI work:** start photo dataset; define category list and evaluation
split (e.g., 80/20).

**Testing:** 15--20 collector and 5--8 recycler interviews; observe at
least one real collection-to-sale round; record price ranges, weighing
practices, phone models, languages, connectivity.

**Deliverables:** research report, personas, journey maps, price sheet,
category taxonomy, ADR-001 (stack), first photo dataset, list of 3+
recyclers willing to pilot.

**DoD:** pain points ranked; category list frozen; ≥ 3 recyclers agree
to pilot; accounts and repo ready.

------------------------------------------------------------------------

# PHASE 1: Product Design (Weeks 2--4)

**Objective:** design usable, low-literacy-friendly flows and lock
service boundaries and contracts before coding.

**Architecture state at end:** paper architecture: service map, event
catalogue v1, API contracts, ER v1, threat model v1.

**Features:** none (design).

**Technical work**

-   **Event storming workshop** (1 session): list domain events → group
    into services → confirm the service map in §0.1.
-   Write event schemas and REST contracts (OpenAPI) for auth, listings,
    offers, transactions.
-   Choose state names/transitions (DRAFT ... COMPLETED) and guard
    conditions.
-   Threat model v1 (STRIDE on: login, upload, offer accept, handover).
-   Define design system: icon set, colours, large touch targets, i18n
    keys (EN/HI).

**Database work:** ER diagram v1 and collection list per service;
indexing plan (2dsphere, unique keys).

**APIs:** OpenAPI drafts (not implemented).

**UI screens (Figma):** splash/onboarding, register/login, dashboard,
add e-waste, camera, category, weight, estimate, nearby recyclers,
offers, comparison, transaction details, GPS handover, photo
verification, history, earnings, safety, profile/settings; recycler
portal screens; admin screens.

**AI work:** design \"AI suggestion\" UX patterns (suggested badge,
top-3 chips, confidence-based behavior, manual override); voice-first
entry mockup.

**Testing:** prototype test with 5 collectors: task success and time on
\"add e-waste\" and \"accept offer\".

**Deliverables:** Figma prototype, SRS v1, event catalogue v1, OpenAPI
drafts, ER v1, threat model v1, backlog (epics in §13).

**DoD:** ≥ 4 of 5 testers complete the core flow in \< 2 minutes;
contracts reviewed by all developers; backlog sized for sprints.

------------------------------------------------------------------------

# PHASE 2: Technical Foundation (Weeks 3--5)

**Objective:** a running skeleton with authentication, CI/CD, and
observability so every later phase ships on a stable base.

**Architecture state at end:** gateway + auth-service + user-service
(base), MongoDB, RabbitMQ, Redis, CI/CD, staging environment.

``` mermaid
flowchart LR
  APP["Mobile / Web"] --> GW["gateway"]
  GW --> AUTH["auth-service"]
  GW --> USER["user-service"]
  AUTH --- BUS(["RabbitMQ"])
  USER --- BUS
  AUTH --> D1[(auth DB)]
  USER --> D2[(users DB)]
  GW --> RD[(Redis)]
```

**Features:** register/login (OTP for collectors; email + password for
recyclers/admin), token refresh, roles, base profiles.

**Technical work**

-   Monorepo with npm workspaces/Turborepo; `packages/contracts` (Zod
    DTOs, event schemas, enums) and `packages/common` (logger, error
    classes, internal-auth verifier, Mongo/Rabbit helpers).
-   Service template (routes → controllers → services → repositories,
    `consumers/`, `producers/`, health endpoint, Dockerfile).
-   Gateway: TLS-ready, JWT verification, rate limiting, request ID,
    signed internal identity header, routing.
-   Docker Compose (all services + Mongo + RabbitMQ + Redis); seed
    scripts.
-   CI: lint, type-check, unit tests, build only **affected** services;
    push images to registry; auto-deploy to staging.
-   Observability: structured JSON logs (pino) with request ID, Sentry,
    `/health` and `/ready` endpoints.
-   Secrets in environment/secret manager; `.env.example` per service.

**Database work:** `auth` DB (users, refreshTokens with TTL, otps with
TTL); `users` DB (collectors, recyclers base); unique indexes on
phone/email.

**APIs:** `POST /auth/register`, `/auth/login`, `/auth/refresh`,
`/auth/logout`; `GET/PUT /collectors/profile`;
`POST/GET/PUT /recyclers/profile` (creation only, no verification yet);
`GET /health`. *Authorization:* auth routes public + rate-limited;
profile routes require valid JWT and owner check.

**UI screens:** splash, onboarding (3 icon slides), language select, OTP
login, profile shell; recycler and admin login pages.

**AI work:** none; add AI provider accounts and a stub `ai-service`
health endpoint (optional).

**Testing:** unit tests for token and OTP logic; integration tests with
a test database; contract tests for `user.registered`; gateway tests for
auth propagation, role guard, and rate limiting; run `docker compose up`
from a clean checkout.

**Deliverables:** staging URL, mobile dev build (internal), Postman
collection, CI dashboard, README with setup.

**DoD:** register → login → refresh → logout works via the gateway on
staging; role and ownership guards tested; CI green; a service crash
does not take down others; no secrets in Git.

------------------------------------------------------------------------

# PHASE 3: Collector MVP (Weeks 5--8)

**Objective:** a collector can record e-waste (even offline), get an
AI-assisted category and value estimate, view history, and read safety
guidance.

**Architecture state at end:** + catalog-service, media-service,
marketplace-service (listings only), ai-service v0, cloud storage.

``` mermaid
flowchart LR
  APP["Collector App<br/>SQLite offline queue"] --> GW["gateway / BFF"]
  GW --> CAT["catalog-service"]
  GW --> MED["media-service"]
  GW --> MKT["marketplace-service<br/>(listings)"]
  GW --> AI["ai-service v0"]
  APP -. presigned upload .-> S3[(S3 / Cloudinary)]
  MED --> S3
  MED -- media.processed --> BUS(["RabbitMQ"])
  BUS --> AI
  BUS --> MKT
  CAT --> D3[(catalog)]
  MKT --> D4[(market)]
  MED --> D6[(media)]
  AI --> D8[(ai)]
```

**Features:** add e-waste (photo, category, weight/quantity, condition);
estimated value range; history; earnings shell (zeros until Phase 5);
safety guidelines (EN/HI); offline queue and sync; data-saver mode.

**Technical work**

-   catalog-service: categories, market prices, condition multipliers,
    safety content; publishes `price.updated`.
-   media-service: pre-signed URLs, MIME/size limits, image re-encoding,
    EXIF extraction, perceptual hash; publishes `media.processed`.
-   marketplace-service: create/list listings, idempotency by
    `(collectorId, clientId)`, estimate call to catalog/ai.
-   Mobile: SQLite schema and migrations; sync engine (queue → batch →
    retry with backoff); on-device image compression (\~800--1024 px);
    i18n; background sync trigger on connectivity change.
-   Gateway BFF: `/bff/home` (dashboard, prices, unread count in one
    payload).
-   ai-service v0: provider adapter, image classification endpoint with
    strict JSON schema, `estimatePrice` pipeline, weight-sanity check.

**Database work:** `catalog` (categories, marketPrices,
conditionMultipliers, safetyGuidelines); `media` (files); `market`
(listings, with images and `ai{}` block); `ai` (aiPredictions with
feedback field). Indexes: `(collectorId, clientId)` unique,
`(status, categoryId)`, 2dsphere on listing `geo`.

**APIs:** `GET /categories`, `GET /prices`, `GET /safety`;
`POST /uploads/presign`; `POST /ewaste`, `GET /ewaste`,
`GET /ewaste/:id`; `POST /sync/batch`; `POST /ai/classify-image`;
`POST /ai/estimate`; `GET /bff/home`. *Authorization:* COLLECTOR only
for listing routes (owner check); catalog reads for any authenticated
user; AI routes rate-limited and size-limited.

**UI screens:** dashboard, add e-waste, camera, category (icon grid + AI
suggestion chips), weight/quantity, estimate, history, listing details,
safety guidelines, earnings shell, settings (language, data saver).

**AI work:** category suggestion with confidence thresholds (≥ 0.85
pre-fill, 0.5--0.85 top-3, \< 0.5 manual); price-range estimate; weight
sanity warning; log accept/correct feedback; run baseline evaluation on
the Phase 0 dataset. *Stretch:* Hindi voice entry (\"2 kilo purane
mobile\").

**Testing:** airplane-mode and flaky-network tests; duplicate-prevention
on repeated sync; image size targets (≤ 300 KB); low-end device (2 GB
RAM) run; estimate formula unit tests; AI accuracy report on held-out
photos; safety-content review by a domain expert.

**Deliverables:** collector APK (internal testing track), catalog seeded
with real categories/prices, AI baseline report.

**DoD:** record e-waste offline → syncs without duplicates; estimate
matches formula for every category; AI never blocks manual entry; median
AI response \< 3 s on 4G; APK size \< \~25--30 MB.

------------------------------------------------------------------------

# PHASE 4: Recycler Marketplace (Weeks 7--10)

**Objective:** verified recyclers can set prices, see nearby listings
and make offers; collectors compare and accept offers.

**Architecture state at end:** + notification-service;
marketplace-service with offers and matching; user-service verification
workflow; AI ranking and fairness scoring; geo indexes live.

``` mermaid
flowchart LR
  R["Recycler Portal"] --> GW["gateway"]
  C["Collector App"] --> GW
  GW --> USER["user-service<br/>verification"]
  GW --> MKT["marketplace-service<br/>offers + matching"]
  MKT -- listing.published --> BUS(["RabbitMQ"])
  MKT -- offer.created / offer.accepted --> BUS
  USER -- recycler.verified --> BUS
  BUS --> NOTIF["notification-service"]
  BUS --> AI["ai-service<br/>ranking + fairness"]
  NOTIF --> FCM[FCM / SMS]
  MKT --> MAPS[Maps API]
```

**Features:** recycler registration with documents; admin verification
(minimal admin screen now, full panel in Phase 6); accepted categories
and buying prices; nearby listings for recyclers; offers (create,
revise, withdraw, expiry); nearby recyclers for collectors with distance
and price; offer comparison; push and SMS notifications.

**Technical work**

-   user-service: verification state machine
    `PENDING → VERIFIED / REJECTED / SUSPENDED`; document upload via
    media-service; publishes `recycler.verified`.
-   marketplace-service: geo matching with MongoDB `$geoNear` and
    2dsphere indexes, filtered by radius and category; offer lifecycle
    (`ACTIVE/ACCEPTED/REJECTED/EXPIRED/WITHDRAWN`); offer-expiry
    scheduler; unique partial index for one active offer per recycler
    per listing; `offer.accepted` event.
-   notification-service: consumes events; FCM push with SMS fallback
    for critical events; retries and DLQ; in-app inbox.
-   ai-service: recycler ranking (weighted score), offer fairness label
    (below / near / above market) with one-line explanation.
-   Recycler portal (React): registration wizard, profile, category and
    price tables, nearby listings map/list, offer form.

**Database work:** `users.recyclers` (documents, acceptedCategories,
serviceRadiusKm, geo, verificationStatus, response metrics);
`market.offers`; `notif` (notifications, deviceTokens); indexes:
2dsphere on recyclers and listings, `offers (listingId, recyclerId)`
partial unique.

**APIs:** `GET /recyclers/nearby`; `POST /offers`, `GET /offers`,
`PUT /offers/:id`; `GET /notifications`, `PUT /notifications/:id/read`;
`PUT /admin/recyclers/:id/verify` (minimal); recycler profile and
category-price endpoints. *Authorization:* only VERIFIED recyclers can
offer; recycler must accept the category and be in range; collector can
accept/reject only offers on own listings; ADMIN for verification.

**UI screens:** collector: nearby recyclers, recycler card, offers list,
offer comparison (fairness bar), accept confirmation; recycler portal:
register, upload documents, verification status, prices, nearby
listings, offer form, my offers; admin: verification queue (basic).

**AI work:** weighted ranking (distance, price, response time,
completion rate, dispute rate); fairness label from estimate and recent
offers; store features for later learning-to-rank.

**Testing:** geo query correctness (known coordinates, radius edges);
concurrency (two recyclers offer simultaneously; double accept); expiry
job; notification delivery and retry; permission tests (unverified
recycler blocked); poor-network behavior of offer screens.

**Deliverables:** recycler web portal, collector offer flow, seeded
pilot recyclers, notification templates (EN/HI).

**DoD:** end-to-end from published listing to accepted offer works on
staging with real pilot recyclers; unverified recyclers cannot offer;
push received within \[10 s\] on 4G; ranking explains its order.

------------------------------------------------------------------------

EOF

# PHASE 5: Transaction & Verification (Weeks 9--12)

**Objective:** complete verified, traceable handovers with a reliable
state machine, earnings ledger and fraud controls.

**Architecture state at end:** + transaction-service (state machine,
saga, verification, earnings, disputes); AI risk scoring; PDF receipts;
DLQs and replay tooling.

``` mermaid
sequenceDiagram
  participant C as Collector App
  participant GW as gateway
  participant M as marketplace
  participant T as transaction
  participant AI as ai-service
  participant N as notification
  C->>GW: Accept offer
  GW->>M: PUT /offers/:id accept
  M-)T: offer.accepted
  T->>T: create txn (unique offerId), HANDOVER_PENDING
  T-)M: transaction.created (close other offers)
  T-)N: notify both parties
  C->>T: handover: GPS + photo
  T->>T: run GPS / photo rules
  T-)AI: handover.verified
  AI-)T: ai.risk.flagged (if risky)
  T->>T: recycler confirms weight, COMPLETED
  T-)N: transaction.completed
```

**Features:** transaction creation on accept; statuses
`HANDOVER_PENDING → HANDOVER_VERIFIED → RECYCLER_CONFIRMED → COMPLETED`
plus `CANCELLED` and `DISPUTED`; GPS handover verification (both
parties); handover photo; recycler confirmation with actual weight and
cash amount; earnings ledger and dashboard; digital receipt
(PDF/shareable); cancel and dispute flows; timeouts (no-show); fraud
flags.

**Technical work**

-   Single `transitionTo(txn, toState, actor, evidence)` function:
    checks role, current state, guards; writes timeline entry; emits
    event; runs inside a MongoDB multi-document transaction with
    earnings creation on completion.
-   **Saga:** `offer.accepted` → create transaction (idempotent by
    `offerId`) → `transaction.created`; compensation event
    `transaction.creation.failed` reverts the offer.
-   Verification rules (configurable): distance ≤ \[150 m\]; accuracy ≤
    \[50 m\]; timestamps within \[N\] min; mock-location flag; implied
    speed plausible; photo EXIF time within window; perceptual-hash
    uniqueness; both parties submitted.
-   Weight tolerance rule (e.g., ±15% from declared) → flag but do not
    block.
-   Earnings ledger append-only; unique `transactionId`.
-   Timeout scheduler (BullMQ) for expired handover windows.
-   Receipt generator (PDF) stored in media; receipt number scheme.
-   DLQ monitoring and an event-replay script.
-   ai-service: risk scoring consumer (`handover.verified`,
    `transaction.completed`) using rules first (duplicate hash, weight
    deviation, GPS anomalies, burst activity, new account with high
    value).

**Database work:** `txn` DB: `transactions` (timeline\[\],
verifications\[\], snapshot{}, riskScore, flagged), `earnings`,
`disputes`; indexes on `offerId` (unique), `(collectorId, createdAt)`,
`(recyclerId, createdAt)`, `status`, `flagged`; `media.files.phash`
index; `ai.aiRiskScores`.

**APIs:** `POST /transactions` (normally server-side),
`GET /transactions`, `GET /transactions/:id`,
`POST /transactions/:id/handover`, `POST /transactions/:id/verify`,
`PUT /transactions/:id/complete`, `POST /transactions/:id/cancel`,
`POST /transactions/:id/dispute`, `GET /earnings`. *Authorization:*
participants only (plus ADMIN read); each action allowed only for the
correct role and state; `Idempotency-Key` required on POSTs.

**UI screens:** transaction details/timeline, GPS handover (map +
distance), photo verification, recycler confirm (weight, amount),
completion and receipt, cancel/dispute forms, earnings dashboard
(day/week/month), history with statuses.

**AI work:** risk score 0--100 with reasons; threshold routes to admin
queue; store admin verdict as label data; start evaluating precision of
flags.

**Testing:** exhaustive state-machine tests (every valid and invalid
transition); saga tests (duplicate events, out-of-order events, service
down mid-saga, replay from DLQ); GPS spoof simulations (mock location,
teleport, wrong place); duplicate photo tests; idempotency (double taps,
retries); concurrency (two confirms); chaos test (stop
transaction-service during accept, restart, verify consistency).

**Deliverables:** complete transaction workflow on staging, receipt
template, event replay tool, updated event catalogue.

**DoD:** happy path and cancel/dispute paths pass; invalid transitions
rejected with clear error; no duplicate transactions or earnings under
retries; flagged cases visible in DB; surviving service restart without
data loss.

------------------------------------------------------------------------

# PHASE 6: Admin Dashboard (Weeks 10--13)

**Objective:** give operations full control and visibility without
developer help.

**Architecture state at end:** + admin-analytics-service (audit
consumer, aggregates, reports); AI insights endpoint; complete admin
panel.

**Features:** manage collectors/recyclers/users (suspend, reset); full
recycler verification queue with document viewer; category/price CRUD
with history; safety-content CMS (multi-language, versioned);
transaction monitor and map; suspicious-transaction queue with
resolve/dismiss/suspend; analytics (volume, prices, active users,
conversion, flagged rate, verification success); reports (CSV/PDF);
audit log viewer; role management (SUPER_ADMIN).

**Technical work**

-   admin-analytics-service consumes all events → `dailyAggregates` and
    `auditLogs`; scheduled aggregation jobs; export jobs.
-   Admin RBAC with fine-grained permissions; admin 2FA (TOTP).
-   Admin routes proxied through gateway with stricter rate limits and
    IP/audit logging.
-   AI insights: natural-language question → **whitelisted,
    parameterized query templates** (never raw DB access); weekly
    auto-summary report.

**Database work:** `analytics` DB (auditLogs, dailyAggregates,
reportJobs); admin permission model in `auth.users`; TTL/retention rules
for logs.

**APIs:** `/admin/users`, `/admin/recyclers/:id/verify`,
`/admin/categories`, `/admin/prices`, `/admin/safety`,
`/admin/transactions?flagged=true`,
`PUT /admin/transactions/:id/resolve`, `/admin/analytics`,
`/admin/reports`, `/admin/audit-logs`, `POST /ai/admin/query`,
`GET /ai/admin/risk-queue`. *Authorization:* ADMIN for operations;
SUPER_ADMIN for audit logs and admin management; every write creates an
audit entry.

**UI screens:** dashboard (KPI cards, charts), users table, recycler
verification (documents side-by-side), price manager, category manager,
safety CMS, transaction monitor, suspicious queue, report generator,
audit viewer, ask-the-data box (stretch).

**AI work:** risk queue UI with reasons; weekly summary generation; NL
query templates and guardrails.

**Testing:** permission matrix tests; report totals vs raw data; audit
completeness (every admin write logged); usability test with 2--3
operations staff.

**Deliverables:** admin panel, operations SOPs (verification checklist,
price update routine, dispute handling).

**DoD:** operations can onboard a recycler, update prices, resolve a
flagged transaction, and export a monthly report without developer help;
all admin actions audited.

------------------------------------------------------------------------

# PHASE 7: Field Testing (Weeks 13--15)

**Objective:** validate with real collectors and recyclers (Objective 4)
and gather data to improve AI and UX.

**Architecture state:** unchanged; adds pilot configuration, feedback
capture and analytics events.

**Features:** in-app feedback/survey (SUS and custom items in local
language); usage event tracking (privacy-preserving); pilot support
number/WhatsApp group; in-app \"report a problem\".

**Technical work:** pilot build via closed testing track; crash and
error reporting; feature flags for risky features; daily data export of
pilot metrics; hotfix pipeline (\< 24 h); seed pilot recyclers with real
prices.

**Database work:** `feedback` and `events` collections (anonymized);
snapshot backups before and after pilot; AI feedback data exported for
evaluation.

**APIs:** `POST /feedback`, `POST /events` (batched, opt-in).

**UI screens:** feedback form, SUS questionnaire, problem report.

**AI work:** measure suggestion acceptance, corrections, price error
against actual recycler amounts, flag precision after admin review;
retrain or tune thresholds using corrected labels.

**Testing / study protocol:** 20--30 collectors and 3--5 recyclers over
2--3 weeks; informed consent; on-site onboarding; tasks: add e-waste,
compare offers, complete handover; metrics: task success and time, SUS,
valuation error, discovery success, handover verification success,
technical failures, trust/transparency ratings, interviews.

**Deliverables:** field-test report (methods, results, quotes, bug log),
prioritized V2 backlog, AI evaluation report.

**DoD:** ≥ 50 real transactions logged; all Sev-1/Sev-2 bugs fixed or
triaged; metrics computed; consent records stored.

------------------------------------------------------------------------

# PHASE 8: Security & Scalability (Weeks 14--16, overlapping)

**Objective:** harden the system and prove it can handle expected
growth.

**Architecture state at end:** hardened production-ready stack;
documented scaling path.

**Features:** admin 2FA enforced; account lockouts; consent management
(DPDP-aligned); data export/delete request handling; retention jobs.

**Technical work**

-   **Security:** revisit threat model; OWASP API Top 10 checklist;
    dependency and container scanning in CI; secret rotation;
    least-privilege Mongo users per service; internal-header signature
    rotation; optional mTLS between services; WAF/rate limits at
    Cloudflare; upload abuse tests; penetration test (self or external).
-   **Scalability:** k6 load tests (gateway, listings, offers,
    ai-service) at 10× pilot traffic; slow-query profiling and index
    review; Redis caching for prices/categories; connection-pool tuning;
    queue backlog tuning; horizontal scaling test (2 replicas of hot
    services); AI cost and latency review with caching and quotas.
-   **Resilience:** retry/backoff policies, circuit breakers on external
    APIs (maps, AI, SMS), graceful degradation (AI off → manual mode),
    backup and **restore drill**, chaos tests (kill each service once).
-   **Privacy:** retention (e.g., precise GPS beyond \[12 months\]
    anonymized), signed short-lived photo URLs, PII-free logs.

**Database work:** index tuning; TTL policies; backup automation;
archival plan for old events.

**APIs:** data export/delete endpoints; no new business APIs.

**UI screens:** consent and privacy settings, delete-my-data request.

**AI work:** cost dashboard; fallback modes; prompt/output logging
without PII; model provider failover.

**Testing:** security test report; load test report (p95/p99, error
rate, saturation points); restore time measured; chaos results.

**Deliverables:** security checklist, load report, privacy policy
(EN/HI), runbooks, scaling plan.

**DoD:** no open critical/high vulnerabilities; p95 \< 500 ms at target
load; restore drill succeeds within \[RTO\]; system degrades gracefully
when AI, SMS or maps fail.

------------------------------------------------------------------------

# PHASE 9: Production Launch (Week 16 and after)

**Objective:** controlled public launch in one city/cluster with
monitoring and support.

**Architecture state at end:** production environment live.

``` mermaid
flowchart LR
  GH[GitHub] --> CI[CI: test + build] --> REG[Registry]
  REG --> STG[Staging] --> APPROVE{Manual approval} --> PROD[Production VMs / containers]
  USERS[Mobile / Web] --> CF[Cloudflare DNS + WAF] --> PROXY[Traefik / Nginx] --> PROD
  PROD --> ATLAS[(MongoDB Atlas, Mumbai)]
  PROD --> MQ[(RabbitMQ)]
  PROD --> RD[(Redis)]
  PROD --> S3[(S3 + CDN)]
  PROD --> OBS[Sentry, logs, uptime, traces]
```

**Features:** Play Store release; staged rollout; onboarding kit;
support workflow.

**Technical work:** production infra with separate secrets; DNS and TLS
(HSTS); blue/green or rolling deploys; monitoring dashboards (latency,
errors, queue depth, DLQ size, AI cost); alerts to phone/WhatsApp/Slack;
on-call rota; runbooks per service (restart, rollback, replay events,
restore DB); backup schedule; status page.

**Database work:** production migrations and index creation; seed
catalog/prices; initial admin accounts; backup verification.

**APIs:** none new.

**UI screens:** store listing assets, in-app \"what\'s new\".

**Testing:** smoke tests post-deploy; rollout 10% → 50% → 100% with
error-rate gates; rollback rehearsal.

**Deliverables:** live product, KPI dashboard, support process and FAQ,
incident template.

**DoD:** stable for 2 weeks, alerts working (test alert fired), rollback
tested, weekly KPI review scheduled.

**KPIs to track:** weekly active collectors, listings per collector,
offer response time, transaction completion rate, flagged rate, average
price vs market, support tickets, crash-free sessions, AI acceptance
rate, cost per transaction.

------------------------------------------------------------------------

# PHASE 10: Future Expansion

**Objective:** grow features and scale based on evidence, not guesses.

  Track                 Items                                                                                                                                                                  Architecture impact                                       Trigger to start
  --------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------- -----------------------------------------------------
  **Payments**          UPI/Razorpay via `PaymentProvider`; payout ledger; reconciliation                                                                                                      New `payment-service`, webhooks, KYC/compliance work      \> \[N\] completed transactions and recycler demand
  **Trust**             Ratings/reviews, dispute mediation tools, trust score                                                                                                                  Extend user + transaction data                            Repeated disputes or requests
  **Languages/voice**   Punjabi and others, richer voice                                                                                                                                       ai-service providers, i18n content                        Pilot feedback
  **AI upgrades**       On-device TFLite recognition; trained price model (XGBoost → ONNX); learning-to-rank; embedding-based duplicate detection; photo weight estimate; demand forecasting   ai-service models + data pipeline; mobile model updates   ≥ \[2,000\] labelled corrections
  **Logistics**         Pickup scheduling, route optimization                                                                                                                                  new `logistics-service`                                   Recyclers offering pickup
  **Compliance**        EPR/CPCB reporting for producers/recyclers                                                                                                                             reporting module, exports                                 Producer/recycler demand
  **Hardware**          IoT weighing scales                                                                                                                                                    device API, signed readings                               Weight disputes high
  **Scale**             Kubernetes/ECS, read replicas, CDN, regional deployment                                                                                                                infra migration, config changes                           p95 \> target or \> \[N\] concurrent users
  **Partnerships**      NGO/government dashboards                                                                                                                                              read-only analytics API                                   MoUs

**DoD for each track:** written hypothesis, success metric, rollout
plan, and rollback plan.

------------------------------------------------------------------------

# 11. Cross-Cutting Tracks by Phase

  Track               P0--1             P2                                P3                    P4                          P5                         P6                 P7                       P8                          P9
  ------------------- ----------------- --------------------------------- --------------------- --------------------------- -------------------------- ------------------ ------------------------ --------------------------- ----------------
  **Security**        Threat model      Auth, RBAC, rate limit, secrets   Upload safety         Verification, permissions   Fraud rules, idempotency   Admin 2FA, audit   Consent, PII-free logs   Pen test, scans, rotation   WAF, alerts
  **DevOps**          Repo, accounts    CI/CD, staging                    Media infra           Schedulers, FCM             DLQ, replay                Jobs, exports      Hotfix pipeline          Load and chaos              Prod, rollback
  **Observability**   n/a               Logs + request ID, Sentry         Latency metrics       Queue depth                 DLQ alerts                 Business KPIs      Pilot dashboards         Traces, SLOs                On-call
  **AI**              Dataset plan      Provider accounts                 Classify + estimate   Rank + fairness             Risk score                 Insights           Evaluation and tuning    Cost and fallback           Monitor drift
  **Testing**         Interviews        Unit + integration                Offline + AI eval     Geo + concurrency           State machine, saga        Permissions        Field study              Security, load              Smoke
  **Docs**            Research          README, ADRs                      API docs              Event catalogue             Runbooks                   SOPs               Study report             Security docs               Runbooks final
  **Privacy**         Consent wording   Consent record                    Photo policy          Doc handling                GPS minimization           Retention          Study consent            DPDP flows                  Policy live

------------------------------------------------------------------------

# 12. Timeline (Gantt) and Dependencies

*Start date is a placeholder; shift it to your real start and account
for exams and holidays.*

``` mermaid
gantt
  title EcoLinkr 16-week MVP plan
  dateFormat  YYYY-MM-DD
  axisFormat  %d %b
  section Discovery
  P0 Research and validation      :p0, 2026-11-02, 14d
  P1 Product design               :p1, 2026-11-09, 21d
  section Build
  P2 Technical foundation         :p2, 2026-11-16, 21d
  P3 Collector MVP + AI v0        :p3, 2026-11-30, 28d
  P4 Recycler marketplace         :p4, 2026-12-14, 28d
  P5 Transaction and verification :p5, 2026-12-28, 28d
  P6 Admin dashboard              :p6, 2027-01-04, 28d
  section Validate and launch
  P7 Field testing                :p7, 2027-01-25, 21d
  P8 Security and scalability     :p8, 2027-02-01, 21d
  P9 Production launch            :p9, 2027-02-15, 7d
```

``` mermaid
flowchart LR
  P0[P0 Research] --> P1[P1 Design]
  P1 --> P2[P2 Foundation]
  P2 --> P3[P3 Collector MVP]
  P3 --> P4[P4 Marketplace]
  P4 --> P5[P5 Transactions]
  P5 --> P6[P6 Admin]
  P5 --> P7[P7 Field test]
  P6 --> P7
  P7 --> P8[P8 Hardening]
  P8 --> P9[P9 Launch]
  P9 --> P10[P10 Expansion]
  P3 -. AI dataset .-> P0
  P7 -. feedback and labels .-> P10
```

### Week-by-week

  Week   Active phases   Milestone / output
  ------ --------------- -----------------------------------------------------------------------------
  1      P0              Interviews started, accounts and repo ready
  2      P0, P1          Research report, category and price sheet, event storming done
  3      P1, P2          Figma prototype; monorepo + CI skeleton
  4      P1, P2          Prototype tested; **gateway + auth on staging**
  5      P2, P3          User-service and profiles; catalog seeded; mobile shell
  6      P3              Media service; camera, compression, upload; AI classify (online)
  7      P3, P4          Offline queue and sync; estimate; recycler registration begins
  8      P3, P4          **Collector app usable with AI assist**; verification workflow
  9      P4, P5          Geo matching, ranking, push notifications; transaction-service skeleton
  10     P4, P5, P6      Offers, fairness score, saga accept → transaction; admin panel start
  11     P5, P6          GPS + photo handover, confirm, ledger, receipts; **end-to-end transaction**
  12     P5, P6          Risk scoring, disputes; admin monitor and catalog CMS
  13     P6, P7          Analytics, reports, audit; **pilot-ready build**; user training
  14     P7, P8          Field testing; security scans, load tests
  15     P7, P8          Continue pilot; fixes; restore drill; AI evaluation
  16     P8, P9          Final report, launch build, production deploy, **launch decision**

------------------------------------------------------------------------

# 13. Development Backlog (Epics)

  Epic   Name                         Phase   Services             Example stories                                          Size
  ------ ---------------------------- ------- -------------------- -------------------------------------------------------- ------
  E1     Platform foundation          2       all                  Monorepo, service template, CI, compose, logging         L
  E2     Auth and accounts            2       auth, user           OTP login, refresh rotation, RBAC, profiles              L
  E3     Catalog and pricing          3       catalog              Categories, prices, multipliers, estimate API            M
  E4     Media pipeline               3       media                Presign, compression, EXIF, pHash                        M
  E5     Collector listing flow       3       marketplace, app     Add e-waste, history, offline queue, sync                XL
  E6     Safety content               3       catalog, app         Guidelines CMS, multilingual screens, audio              S
  E7     AI assist v1                 3       ai                   Classify photo, estimate, weight sanity, feedback        L
  E8     Recycler onboarding          4       user, portal         Registration, documents, verification                    L
  E9     Offers and matching          4       marketplace          Nearby search, offers, expiry, comparison                XL
  E10    Notifications                4       notification         FCM, SMS fallback, inbox, templates                      M
  E11    AI ranking and fairness      4       ai                   Weighted ranking, fairness label                         M
  E12    Transactions and saga        5       transaction          State machine, saga, timeouts, disputes                  XL
  E13    Verification                 5       transaction, media   GPS rules, photo rules, weight tolerance                 L
  E14    Earnings and receipts        5       transaction          Ledger, dashboard, PDF receipt                           M
  E15    Fraud and risk               5       ai, transaction      Rules, duplicate photos, risk queue                      L
  E16    Admin panel                  6       admin-analytics      Verification, CRUD, monitor, analytics, reports, audit   XL
  E17    AI insights                  6       ai                   NL queries with templates, weekly summary                M
  E18    Field study                  7       app, ops             Feedback, SUS, analytics events, report                  M
  E19    Security and privacy         8       all                  Scans, pen test, consent, retention                      L
  E20    Performance and resilience   8       all                  Load tests, caching, chaos, restore drill                L
  E21    Launch and operations        9       infra                Prod deploy, monitoring, runbooks, store release         M

*(S ≈ ≤ 1 week for one dev, M ≈ 1--2 weeks, L ≈ 2--3 weeks, XL ≈ 3--4
weeks.)*

------------------------------------------------------------------------

# 14. Global Quality Gates and Cut Lines

**Every service must have (checked at each phase gate):**
health/readiness endpoints · OpenAPI spec · Zod validation · unit +
integration tests · event contract tests · structured logs with request
ID · least-privilege DB user · runbook · Dockerfile ·
`docker compose up` works from a clean checkout.

**Gate reviews:** end of P2, P3, P5, P7, P8. A gate passes only when the
phase DoD is met and open Sev-1 bugs = 0.

**If you fall behind, cut in this order** (never cut the core loop,
verification, or fraud rules):

1.  Natural-language admin insights and weekly AI report
2.  Voice entry and safety chatbot
3.  Learning-based ranking (keep the weighted score)
4.  Extra languages beyond EN/HI
5.  Split services (merge notification and media into others, as in the
    capstone configuration)
6.  Advanced analytics and PDF reports (keep CSV)

**Never cut:** offline capture and sync · offer-to-transaction saga with
idempotency · GPS + photo verification · state machine · earnings ledger
· admin verification of recyclers · audit logs · backups.

------------------------------------------------------------------------

# 15. Capstone Mapping

  Report chapter         Use from this plan
  ---------------------- -----------------------------------------------------------------------------------------
  Ch. 3 Requirements     Features per phase, backlog epics
  Ch. 4 Design           §0 service map, per-phase architecture diagrams, sequence diagram (P5), deployment (P9)
  Ch. 5 Implementation   \"Technical work\" and \"Database work\" of P2--P6, Gantt
  Ch. 6 Testing          \"Testing\" per phase, P7 study protocol
  Ch. 7 Future work      Phase 10 table
  Viva                   §14 cut lines and gate reviews show engineering judgment
