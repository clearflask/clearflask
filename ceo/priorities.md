# Priorities — Working Backlog

_Last updated: 2026-07-13. Statuses: TODO / IN PROGRESS / BLOCKED(on) / DONE._

## P0 — Lean-compose variant (BOARD-approved 2026-07-03; unblocks all listings)
Drop localstack: local-disk file storage + embedded/local DynamoDB so the stack
is server + connect + MariaDB. Durable fix for the packaging blocker that stalled
the Railway live test (server hung on localstack over IPv6 private net). Unlocks
Railway + PikaPods + Umbrel + CasaOS.
- [x] Scope the two swaps — done (`specs/lean-compose.md`).
- [x] Design: NOT an option inside self-host — a new **PRODUCTION_PLATFORM**
      deployment type (board call). Self-hosters untouched.
- [x] Implement — committed `e5c93029` (+ test fix `6c2e5a94`). **CI GREEN.** The
      parameterized ServiceInjectorTest now builds the injector for PRODUCTION_PLATFORM
      successfully (validates the wiring). Includes LocalDiskContentStore, file-backed
      EmbeddedDynamoDbProvider, config-platform.cfg, native-lib packaging,
      docker-compose.platform.yml.
- [~] Release 2.6.0 cut to publish platform images + native libs (CI doesn't push
      images). Monitoring. Needed before any deploy test.
- [x] **Durability test PASSED (2.6.1, local docker amd64 emulation).** Platform
      server boots fully (native lib extracted from WAR, embedded DynamoDB init,
      health 200). Created super-admin account via API (HTTP 200) → sqlite
      `shared-local-instance.db` persisted to the volume → **restarted the server
      container → logged in with the pre-restart account (HTTP 200)**. Data survives
      restart. Platform-hosting validated end-to-end.
- [x] **Proven LIVE on Railway (2026-07-05).** Template rebuilt for the platform
      stack; public instance worked end-to-end (dashboard, signup, project,
      /api/health). Torn down after board test. Fixes on master: mariadb IPv6
      bind, dummy AWS creds, JVM heap cap for 1 GB hosts, connect mkdir.
- [x] **Single-tenant platform mode (2026-07-06, `527bea61`).** Answers the
      subdomain constraint: one project on the root domain, super-admin-only
      signup, project cap 1, no slug/domain fields. Generated host domains are
      now fully usable without custom DNS. Plus `make platform-up` local stack.
- [x] **Single-tenant mode VALIDATED end-to-end locally (2026-07-06)** on
      locally-built amd64 images via `make platform-up` (no release needed —
      release-free test process now in `ceo/CLAUDE.md`): non-admin signup
      rejected; admin signup OK; create wizard has no slug/domain fields;
      project bound to root domain; portal + anonymous SSR served on root
      domain; second project blocked by API; "Add project" hidden; data +
      session survived server restart.
- [x] Release 2.6.3 (patch) — board-approved 2026-07-06, shipped. GHCR images
      `2.6.3` + Helm charts published; carries single-tenant platform mode.
- [x] **Railway template rebuilt on 2.6.3 + live re-test PASSED (2026-07-08).**
      All 3 services Online first try; single-tenant verified live; portal works
      on the generated domain. See minutes/2026-07-08-railway-retest.md.
- [x] **PUBLISHED (2026-07-08): https://railway.com/deploy/clearflask** — live on
      the Railway marketplace with full listing copy; stale 9geeXl deleted; test
      project torn down. P0 COMPLETE.
- [x] Follow-ups investigated (2026-07-13): the **50% OSS promo is over** (was a
      limited-time offer; current program is 15% base + 10% support bonus = 25%
      max — we're already at max potential, nothing to enroll). The **+10% bonus
      is automatic**: answer user questions in the Template Queue
      (station.railway.com/my-template-queue) as they arrive — no enrollment.
      NEW opportunity: **Open Source Partner application** (railway.com/partners
      → "Become a partner") gives a Verified badge + featured placement, same
      rates. BOARD: submit the form (CEO drafted answers in
      `specs/railway-template.md`).
- [ ] Monitor Template Queue for user questions (answers earn the +10% bonus;
      draft answers for board review per posting rules) + listing analytics.
- [ ] amd64-only platform image constraint (sqlite4java has no arm64 build) —
      release images are already amd64+arm64 via buildx; platform runs amd64.
      Documented; revisit only if arm64 pulls of the server image cause reports.

## P1 — Self-host marketplace listings (passive revenue + funnel)
Status: IN PROGRESS — research done (see `reports/marketplace-research-2026-07-02.md`
and `reports/packaging-audit-2026-07-02.md`). Executing in this order:
- [x] Research listing requirements + revenue share per platform. Verdict: Railway
      first (self-serve, 15–25% cash kickback, 50% OSS promo live), then PikaPods
      (20% share, Fider already there), Elestio (negotiate ~20–30%), DO Marketplace
      (funnel only), Umbrel/CasaOS (cheap PRs). Coolify blocked until 1,000 stars.
- [x] Audit self-host packaging. Verdict: ~70% ready; 4-container stack, no env-var
      config, shared hardcoded secrets (advisory-grade), localstack/DynamoDB is the
      architectural gap.
- [x] First-boot secret generation (`SelfHostConfigBootstrap.java`) — committed
      `87a4dd4a`, CI validating.
- [x] Env-var config support (server + connect) — committed `87a4dd4a`.
- [x] Cut release 2.5.0 — GHCR images `:latest`/`:2.5.0` now carry env-var
      support. Workflow green, tag pushed, Helm charts published.
- [~] Railway template: BUILT and SAVED in Railway (Matus's account), name
      "ClearFlask", deploy URL railway.com/deploy/9geeXl. 4 services wired via
      cross-service refs + secret(32) connect token, volumes attached,
      super-admin email left as user-fill. NOT YET PUBLISHED — live-testing a
      deploy first (project "zippy-amazement"). See `specs/railway-template.md`.
- [x] Outreach drafts written: `outreach/pikapods-draft.md`,
      `outreach/elestio-draft.md`. BOARD: review + send.
- [ ] Lean compose variant dropping localstack (local-disk file storage; embedded
      answer for DynamoDB) — unlocks PikaPods/Umbrel/CasaOS cheaply.
- [x] Lean compose variant — DONE via P0 (PRODUCTION_PLATFORM stack, 2.6.3).
- [x] README "Deploy on Railway" button added (2026-07-13) — one-click deploy
      section at the top of Self Hosting; every deploy through it earns kickback.
- [ ] BOARD: send refreshed outreach (2026-07-13 drafts in `outreach/`):
      PikaPods follow-up to hello@pikapods.com (no reply since 07-03) and
      Elestio to support@elest.io (first attempt bounced). Both now pitch the
      lean 3-container stack + live Railway listing as proof.
- [ ] Prepare listing assets: description, screenshots, logo, categories.
- [ ] DO Marketplace Packer image (after the above).

## P2 — AI dedupe + weekly digest, then relaunch
Status: IN PROGRESS (spec drafted 2026-07-13).
- [x] Audit LangChain4j usage + post merging (2026-07-13). Big findings: post
      merging is FULLY BUILT (API+model+admin UI, not broken); lexical
      similar-posts already suggests duplicates at post-create; a weekly digest
      cron ALREADY RUNS (WeeklyDigestService + OnDigest email + plan gating);
      LLM plumbing exists (LangChain4j/OpenAI, global key). No embedding infra.
- [x] Spec drafted: `specs/ai-dedupe-digest.md` — v1 is LLM-reranked lexical
      candidates (no vector DB), admin "suggested merges" endpoint + UI, AI
      themes + duplicates sections in the existing digest. BOARD: review spec
      (esp. gating: Business-tier on cloud, own-API-key on self-host; also
      plan-gate the currently-ungated AI chat).
- [ ] Implement (est. a few sessions; no new infra/schema).
- [ ] Ship behind a plan flag (Business tier / cloud).
- [ ] Relaunch: Product Hunt + HN "Show HN" draft for board review.

## P3 — Distribution basics
Status: TODO.
- [ ] SEO comparison pages: "Canny alternative", "UserVoice alternative",
      "Fider vs ClearFlask", "Featurebase alternative" on clearflask.com.
- [ ] G2 + Capterra listings (BOARD: account signup).
- [ ] Finish Slack integration (plan: `plans/slack-integration-plan.md`).
- [ ] Jira integration next (`plans/jira-integration-exploration.md`).

## P4 — Pricing restructure
Status: TODO.
- [ ] Audit current live Stripe plans vs target shape:
      Free (1 project, branded) → ~$29 Growth → ~$99 Business (SSO/whitelabel/AI).
- [ ] Define open-core boundary for self-host paid features.
- [ ] BOARD decision: approve final pricing before touching live Stripe catalog.

## P5 — Trust quick-wins (feeds the pitch, small effort)
Status: IN PROGRESS.
- [x] Fix README self-host quick-start email (`admin@clearflask.com` →
      `admin@localhost`) and wrong telemetry opt-out key (2026-07-02).
- [ ] Fix CSS injection (`clearflask-frontend/src/app/AppThemeProvider.tsx:102`).
- [ ] Cookie security flags (`AuthenticationFilter.java:111-138`).
- [ ] Fix comment replies (`CommentList.tsx:29`) — demo-path bug.
- [ ] Default telemetry off for self-host or fix docs; gate JMX behind opt-in;
      bump EOL image pins (localstack 0.14.3, mariadb 10.5, ES 7.10.0).

## Explicitly NOT doing (unless it feeds the above)
- React 18 / MUI 5 / Webpack 5 / Java 17 migrations.
- New storage backends, KillBill cleanup beyond what Stripe work requires.
