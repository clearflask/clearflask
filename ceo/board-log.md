# Board Log — decisions & asks

_Newest first. BOARD ASK = waiting on Matus. DECISION = direction agreed._

## 2026-07-03
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
