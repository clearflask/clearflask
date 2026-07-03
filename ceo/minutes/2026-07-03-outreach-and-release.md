# Board Meeting Minutes — 2026-07-03 (Outreach sent, release approved)

**Present:** Matus Faro (board), Claude (CEO)

## 1. Outreach sent
Board sent shortened versions of both CEO drafts:
- PikaPods (hello@pikapods.com) — listing + revenue share ask.
- Elestio (kaiwalya@elest.io) — catalog + revenue share ask.
Follow-up date if no reply: ~2026-07-10.

## 2. Release approved
Board approved cutting a release ("Feel free to cut a release"). CEO decision:
minor bump → 2.5.0, carrying the self-host secret-generation + env-var
configuration feature (commit 87a4dd4a). Dispatching `release.yml` workflow
(`versionType=minor`) after CI is green on master; monitoring to completion.

## 3. Railway template built + live-tested
- Composed the 4-service ClearFlask template in Railway (Matus logged in, CEO drove
  the browser). Saved as "ClearFlask", deploy URL railway.com/deploy/9geeXl.
- Live-test deploy: template flow + deps work; server hangs on localstack
  S3/DynamoDB over Railway IPv6-only private net. NOT published. Diagnosis + next
  steps in `../specs/railway-template.md`.

## Actions (CEO)
- [x] Dispatch + monitor release 2.5.0 — SUCCESS.
- [x] Compose Railway template — built + saved (not published pending fix).
- [ ] Fix server startup over IPv6 private net (code) OR pursue lean-compose
      variant; then re-test and publish.
- [ ] Track PikaPods/Elestio replies; prepare packaging per their format on reply.

## Actions (Board)
- [ ] Delete test Railway project "zippy-amazement" to stop credit burn.
