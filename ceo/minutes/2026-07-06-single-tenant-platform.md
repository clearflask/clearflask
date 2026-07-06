# Minutes — 2026-07-06 — Single-tenant platform mode shipped

Present: CEO (Claude). Board not present (async session; board opened with
"what's next?").

## Context

Session picked up the in-flight working tree from 2026-07-05: the single-tenant
answer to the platform routing constraint (one-click hosts have no wildcard
subdomains, so per-project portals on `slug.<domain>` are unreachable on
generated domains).

## Work done

- Reviewed and completed the single-tenant PRODUCTION_PLATFORM feature:
  - Frontend: `ENV=platform` → `Environment.PRODUCTION_PLATFORM`, new
    `isSelfHostLike()` used everywhere platform should behave like self-host;
    dashboard hides "Add project" at 1 project; CreatePage binds the project to
    the root domain and hides slug/domain fields.
  - Server: `Environment.isPlatform()`; signup restricted to the configured
    super-admin (invitations exempt); project count hard-capped at 1.
  - Compose/Makefile: `docker-compose.platform.yml` sets `ENV=platform`,
    `CLEARFLASK_API_BASE_PATH`, domain/HTTPS toggles; new `make platform-up` /
    `platform-down` local test targets.
  - Fixed stale `windowIso.ENV` type union (added `'platform'`).
- Validation: frontend tsc clean (only pre-existing node_modules typing noise);
  server symbols verified; full build delegated to CI per board preference.
- Committed `527bea61`, merged remote (release 2.6.2 had landed), pushed;
  monitoring CI.
- Cabinet updated: board-log reordered to newest-first and 2026-07-06 entry
  added; priorities P0 refreshed.

## Decisions

- DECISION (board, later in session): **every release now requires explicit
  per-release board approval** — board pushed back on release cadence (four
  releases in five days) and on the CEO preparing to cut 2.7.0 unilaterally.
  Recorded in `ceo/CLAUDE.md`. Commit/push authority unchanged.
- DECISION (board): **version-bump convention corrected** — patch is the default
  for almost everything; minor only for major user-facing features. The CEO had
  been doing the opposite (five minor bumps in days). `ceo/CLAUDE.md` updated.
- Proposal to board: next release is **2.6.3 (patch)** — single release containing
  exactly one feature commit (`527bea61`, single-tenant platform mode). CI green.

## Local end-to-end validation (later in session — PASSED)

Board pushed back again on testing-via-releases; CEO documented a release-free
test process (`ceo/CLAUDE.md`) and ran it: built images locally (fixes needed on
this machine: arm64 protoc classifier override vs the forced `osx-x86_64` in
`~/.m2/settings.xml`; fabric8 buildx endpoint repointed to Docker Desktop socket;
server image rebuilt `linux/amd64` for sqlite4java), then `make platform-up` and
tested through the real dashboard UI + API:

1. Non-admin signup → 400 "This instance only allows its administrator to sign up".
2. `admin@localhost` signup → 200; UI login works.
3. Create wizard shows NO slug/domain fields; project created bound to root
   domain (`domain: localhost`).
4. Second project via API → 400 "Your plan has reached project limit".
5. "Add project" absent from the dashboard account menu.
6. Portal + anonymous SSR served on the root domain (`<title>Example</title>`).
7. Server container restart → health OK, project + admin session survived.

Stack torn down after the test.

## Action items

- [x] CEO: watch CI on `527bea61` — GREEN (run 28807701598).
- [x] CEO: validate single-tenant mode end-to-end locally — PASSED (above).
- [ ] BOARD: approve (or reject) release 2.6.3 (patch).
- [ ] CEO (after approval + images publish): rebuild Railway template on 2.7.0
      (ENV=platform, JAVA_TOOL_OPTIONS, drop connect volume), re-test live
      (needs board for any credit spend approval).
- [ ] BOARD: publish approval for the Railway template after re-test.
- [ ] BOARD: Elestio resend to support@elest.io (carry-over from 2026-07-03).
