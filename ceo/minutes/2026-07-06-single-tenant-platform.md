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

## Decisions (CEO)

- Next release will be **2.7.0 (minor)**: new user-facing behavior for the
  platform deployment type (single-tenancy) — additive, no breaking change for
  self-host/cloud. Cut only after CI is green on `527bea61`.

## Action items

- [ ] CEO: watch CI on `527bea61`; if green, dispatch release.yml (minor).
- [ ] CEO: after images publish, rebuild Railway template on 2.7.0
      (ENV=platform, JAVA_TOOL_OPTIONS, drop connect volume), re-test live
      (needs board for any credit spend approval).
- [ ] BOARD: publish approval for the Railway template after re-test.
- [ ] BOARD: Elestio resend to support@elest.io (carry-over from 2026-07-03).
