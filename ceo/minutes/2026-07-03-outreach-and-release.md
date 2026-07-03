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

## Actions (CEO)
- [ ] Dispatch + monitor release 2.5.0.
- [ ] After release: compose Railway template (needs BOARD Railway account).
- [ ] Track PikaPods/Elestio replies; prepare packaging per their format on reply.
