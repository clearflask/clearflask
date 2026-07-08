# Minutes — 2026-07-08 — Railway template rebuilt on 2.6.3, live re-test PASSED

Present: CEO (Claude); board approved the re-test spend earlier ("go ahead").

## Template changes (j5dQvf, in Railway template editor)

- clearflask-connect: `ENV=platform` (was selfhost); no volume (2.6.3 carries the
  mkdir fix).
- clearflask-server: added `JAVA_TOOL_OPTIONS=-Xmx256m -XX:MaxMetaspaceSize=224m
  -Xss512k -XX:ReservedCodeCacheSize=64m -XX:+ExitOnOutOfMemoryError` (with
  description) to the template itself; volume mount widened
  `/opt/clearflask/dynamo` → `/opt/clearflask` (persists generated config secrets
  too); healthcheck confirmed unset; `CLEARFLASK_ENVIRONMENT=PRODUCTION_PLATFORM`
  confirmed.
- mariadb: verified start command still carries `docker-entrypoint.sh … --bind-address=::`.
- Images remain `:latest` (= 2.6.3 since yesterday's release).

## Live re-test (project "sunny-unity", 54a18510-5dd0-48fb-9f10-de61c25907f0)

All 3 services **Online on first deploy — zero manual intervention** (contrast
with 2026-07-03 which needed four fixes applied live). Verified against
https://clearflask-connect-production-2018.up.railway.app:

1. `/api/health` → ok.
2. Non-admin signup → 400 "This instance only allows its administrator to sign up".
3. `admin@localhost` signup → 200.
4. Project created bound to the generated domain; **second project → 400 plan limit**.
5. **Portal renders on the generated up.railway.app domain** — anonymous SSR,
   `<title>Feedback</title>`, /dashboard and /login both 200. The wildcard-subdomain
   constraint from 2026-07-05 is fully resolved live.

Cost: negligible (test instance up ~15 min during verification).

## Notes

- Railway had a US-West build-slowness incident during the session; didn't
  affect the deploy materially.

## Action items

- [ ] BOARD: optionally test the live instance, then instruct shutdown (CEO
      will tear down; will not leave it running past the session).
- [ ] BOARD: approve publishing template j5dQvf to the marketplace + enrolling
      in the kickback / OSS promo.
- [ ] BOARD: approve deleting the stale localstack template 9geeXl (or delete it
      yourself) before publish.
- [ ] CEO after publish: listing assets (description, screenshots, categories) —
      draft copy exists in specs/railway-template.md.
