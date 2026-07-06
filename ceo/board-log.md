# Board Log — decisions & asks

_Newest first. BOARD ASK = waiting on Matus. DECISION = direction agreed._

## 2026-07-06
- DECISION (board): **every release requires explicit per-release board approval.**
  No more releasing on CEO judgment (four releases had gone out in five days:
  2.5.0, 2.6.0, 2.6.1, 2.6.2). CEO brings the commit list + proposed version to
  the board and waits for a yes. Recorded in `ceo/CLAUDE.md` operating rules.
  Commit/push authority unchanged.
- BOARD ASK (pending): approve **release 2.7.0 (minor)**. Contents on master since
  2.6.2: exactly one feature commit — `527bea61` single-tenant platform mode
  (below). CI green. Purpose: GHCR images only publish on release, and the Railway
  template re-test needs images carrying this feature.
- SHIPPED: **single-tenant mode for PRODUCTION_PLATFORM** (`527bea61`) — the durable
  answer to the 2026-07-05 subdomain/routing constraint. Platform deploys are now a
  one-project appliance on the root domain: dashboard signup restricted to the
  configured super-admin (teammate invites still work), project count hard-capped
  at 1, CreatePage binds the project to the root domain (no slug/domain fields),
  "Add project" hidden once one exists. Self-host and cloud behavior unchanged.
  Also: `make platform-up`/`platform-down` for local testing of the platform stack,
  and compose now sets `ENV=platform` + API base path + HTTPS toggles. CI validating.
- With this, custom domains + wildcard DNS are OPTIONAL polish (multi-project users
  can still self-host); the generated Railway/PikaPods domain is fully usable
  out of the box. Unblocks a polished public listing.
- NEXT (pending release approval above): rebuild the Railway template on the
  released images and re-test live.
- BOARD ASK (pending): approve publishing the Railway template publicly once the
  re-test passes; Elestio resend to support@elest.io still pending (2026-07-03).

## 2026-07-05
- MILESTONE: **platform-hosting proven LIVE on Railway, end-to-end.** Rebuilt the
  template for the PRODUCTION_PLATFORM stack (server + connect + MariaDB, no
  localstack) and got a working public instance: dashboard, signup, account +
  project creation, /api/health "ok" through connect→server→MySQL→embedded-Dynamo.
  Board tested it, then instructed shutdown; test project deleted (cost ~$0.01).
- Fixes committed to master (see specs/lean-compose.md): mariadb IPv6 bind +
  entrypoint, dummy AWS creds, JVM heap cap for 1 GB hosts, connect mkdir config dir.
- CONSTRAINT FOUND: project portals are subdomain-based; one-click hosts' generated
  domains can't do wildcard subdomains (and *.up.railway.app is HSTS-preloaded), so
  portals need a custom domain. Dashboard/admin unaffected. This gates a *polished*
  public listing — see recommendation to board (2026-07-05).
- P0 is effectively complete except: (1) publish decision + template polish
  (JAVA_TOOL_OPTIONS var; connect volume until a release carries the mkdir fix),
  (2) the single-domain routing question — ANSWERED 2026-07-06: single-tenant mode.

## 2026-07-03
- MILESTONE: **platform-hosting validated end-to-end.** Durability test passed on
  2.6.1 — account created before a server-container restart survived it (embedded
  file-backed DynamoDB persists to volume). Releases: 2.6.0 (feature), 2.6.1 (fix:
  bundle native lib in WAR + require connect token). Next: rebuild + republish the
  Railway template for platform mode (needs board OK to publish publicly).
- DECISION (board): the lean stack is NOT an option within self-hosting — it's a
  **new deployment type PRODUCTION_PLATFORM** for one-click marketplace deploys.
  Existing self-hosters keep real DynamoDB/S3, unchanged. Implemented + committed
  (`e5c93029`); CI validating.
- BOUNCE: Elestio outreach to kaiwalya@elest.io bounced (address not found).
  BOARD ASK: resend to `support@elest.io` (or contact form elest.io/contact).
  See `outreach/elestio-draft.md`.
- DECISION (board): fix the storage/packaging blocker via the **lean-compose
  variant** — drop localstack; local-disk file storage + an embedded/local
  DynamoDB answer, so the stack is server + connect + MariaDB. Durable fix that
  unlocks Railway + PikaPods + Umbrel + CasaOS together. This becomes the new P1.
- Test Railway project "zippy-amazement" DELETED (board instructed "you shut it
  down"; 48h grace period). Credit burn stopped.
- Release 2.5.0 shipped (env-var config + first-boot secrets). Images on GHCR.
- Railway template BUILT + SAVED in Matus's account (railway.com/deploy/9geeXl),
  name "ClearFlask", 4 services. **NOT published** — live test surfaced the
  predicted server-startup hang on localstack S3/DynamoDB over Railway's IPv6-only
  private network (see `specs/railway-template.md` LIVE TEST RESULT).
- BOARD ASK (pending): delete test Railway project "zippy-amazement" (ID
  7f546d5f-c8d9-41cf-8cf7-9bffc0d975db) to stop credit burn — CEO won't delete a
  whole project unilaterally. Trial still shows full $5.00; burn negligible so far.
- OUTREACH sent to PikaPods + Elestio (see `outreach/`).

## 2026-07-02
- DECISION (board): **CEO has standing commit authority** — commit/push tested work
  without per-commit approval; CI validates. Granted after CEO asked approval for
  the self-host secrets/env-var feature.
- DECISION (board): **the company runs in the open** — `./ceo` is un-gitignored and
  checked into the public repo as the "company birth" commit.
- REPORTS: marketplace research + self-host packaging audit completed and filed
  under `reports/`. P1 plan concretized: Railway → PikaPods → Elestio → DO →
  Umbrel/CasaOS; blockers are secret generation, env-var config, lean compose.
- BOARD ASK (pending): Railway account signup + OSS kickback promo enrollment when
  the template is ready; approve outreach drafts to PikaPods and Elestio (CEO will
  draft, never send directly).
- DECISION (board): CEO office established. Claude owns ClearFlask direction;
  Matus acts as board of directors — large directions go to him, he assists with
  signups, research, and anything needing a human/money.
- DECISION (CEO): priority order P1 marketplace listings → P2 AI dedupe/digest +
  relaunch → P3 distribution basics → P4 pricing → P5 trust quick-wins.
  Rewrites deprioritized. See `priorities.md`.
