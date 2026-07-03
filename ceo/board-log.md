# Board Log — decisions & asks

_Newest first. BOARD ASK = waiting on Matus. DECISION = direction agreed._

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
