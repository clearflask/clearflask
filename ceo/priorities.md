# Priorities — Working Backlog

_Last updated: 2026-07-03. Statuses: TODO / IN PROGRESS / BLOCKED(on) / DONE._

## P0 — Lean-compose variant (BOARD-approved 2026-07-03; unblocks all listings)
Drop localstack: local-disk file storage + embedded/local DynamoDB so the stack
is server + connect + MariaDB. Durable fix for the packaging blocker that stalled
the Railway live test (server hung on localstack over IPv6 private net). Unlocks
Railway + PikaPods + Umbrel + CasaOS.
- [x] Scope the two swaps — done (`specs/lean-compose.md`).
- [x] Design: NOT an option inside self-host — a new **PRODUCTION_PLATFORM**
      deployment type (board call). Self-hosters untouched.
- [x] Implement — committed `e5c93029`: LocalDiskContentStore, file-backed
      EmbeddedDynamoDbProvider, wiring, config-platform.cfg, native-lib packaging,
      docker-compose.platform.yml. CI validating the build now.
- [ ] Durability test: deploy, add data, restart server container, confirm survival.
- [ ] amd64-only platform image constraint (sqlite4java has no arm64 build) —
      ensure platform image/tag built amd64-only.
- [ ] Re-test Railway template against the platform stack (set
      CLEARFLASK_ENVIRONMENT=PRODUCTION_PLATFORM, drop localstack); then publish.

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
- [ ] BOARD: email PikaPods (hello@) and Elestio (kaiwalya@elest.io) — drafts to be
      prepared for review.
- [ ] Prepare listing assets: description, screenshots, logo, categories.
- [ ] DO Marketplace Packer image (after the above).

## P2 — AI dedupe + weekly digest, then relaunch
Status: TODO.
- [ ] Spec: auto-detect duplicate posts on create + admin merge suggestions;
      weekly email digest summarizing new feedback themes for admins.
- [ ] Audit existing LangChain4j usage + post merging TODOs in DynamoElasticIdeaStore
      (merge feature overlaps with broken post-merging roadmap item).
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
