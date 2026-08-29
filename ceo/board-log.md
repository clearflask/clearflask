# Board Log — decisions & asks

_Newest first. BOARD ASK = waiting on Matus. DECISION = direction agreed._

## 2026-08-29
- **CORRECTION (board pushback): "i dont think the website was down."** The board
  was right. The CEO described 65 Connect service restarts as outages without
  ever measuring user impact. Measured afterwards: each crash cost **9-15
  seconds** of refused connections (eight samples from the logs), so 65 of them
  across five days is roughly **11 minutes total** — ~2 minutes on a typical day,
  ~8 on Aug 24's burst. That is ~99.85% availability, and a visitor would have
  had to land inside a ten-second window to see anything.
- Nothing fronts Connect (no `Via`/`X-Cache`/`X-Amz-Cf-Id` on responses), so
  those seconds were genuinely unavailable rather than absorbed by a CDN — but
  brief unavailability is not an outage, and "took the site down" was wrong.
- The fix still stands on its merits: it removed a self-inflicted failure any
  client could trigger, and the rate was climbing. The `www` 500 finding also
  stands — that one was verified directly with curl before and after.
- Cabinet language corrected in place (2026-08-27 and 2026-08-28 minutes, and
  the 08-28 board entry); full measurement table in the 08-28 minutes.
- LESSON: never call a service restart an outage without measuring the window.
  Report what the logs prove, and measure before characterising user impact.
- **Access log read for the first time** — the gap the pushback exposed. Four
  days: 27,010 / 29,694 / 26,862 / 22,883 requests, and **0 / 1 / 0 / 0** 5xx.
  The single 5xx was the CEO's own curl probe. So the API tier was serving
  clean responses the whole time: the 5,241 SEVERE traces/day were purely a
  logging defect, and the `userBind` 500 was real but never hit by a user.
  LESSON: read the access log first — error logs measure how loudly a system
  complains, not what it delivered.
- **The refork fix proved itself unprompted**: a worker died for real at
  10:28:10 today; it was replaced and rendering continued *in the same second*,
  with the service never restarting. Better evidence than the staged test.
- **Fixed what killed it**: `Promised` subscribes to its promise only outside
  SSR, so a rejection server-side is unclaimed and
  `--unhandled-rejections=strict` ends the worker. An embed-status render of a
  post the viewer could not read did exactly that. All four callers were
  exposed; fixed centrally and at the PostStatus source.
- **Two dead cron jobs removed** (backed up to `/root/decommissioned-2026-08-29/`):
  `killbill-cleanup` had logged an error every 30 min — 319 failures, zero
  successes ever — guarding on `mysqld` when the host runs mariadb, and pointing
  at a `killbill` database that no longer exists (decommissioned in the Stripe
  migration). And `/etc/cron.d/clearflask` was malformed (missing the user
  field), so its nightly restarts never ran; removed rather than repaired,
  since `/etc/cron.daily/tomcat_restart` already does the Tomcat restart and
  repairing it would have added a redundant restart plus a needless ~10s
  connect gap.
- 21 "Render timeout" warnings today were all inside the nightly Tomcat restart
  window (03:17). Benign; recorded so nobody chases them.

## 2026-08-28
- **Resilience follow-ups + triage backlog cleared** (board: "continue and make
  it more resilient, fix up all the things you found"). Full detail in
  `minutes/2026-08-28-resilience-followups.md`.
- Yesterday's fixes measured after ~20h in production: worker deaths 13/day ->
  **0**, service failures 13/day -> **0**, SSR failures ~1,300/day -> **0**,
  Tomcat SEVERE 5,241/day -> **0**, render timeouts 1,527 -> **0**, against
  15,529 successful renders. The application log is now 100% INFO.
- **Connect no longer kills the whole cluster when one worker dies** — the
  design the board was asked about yesterday. The master forks a replacement;
  a crash-loop guard (ten deaths in a minute) still hands off to systemd for the
  case the old behaviour actually protected against.
- **Pre-handshake sockets bounded** with a 30s first-byte timeout: until the
  first byte arrives no server owns the connection, so nothing else timed it out.
- **30 remaining `getProject(...).get()` call sites** now return 404 instead of
  500 for an absent project — with the handled-error flood gone from SEVERE,
  these would have been the noise that replaced it.
- Verified properly: BUILD SUCCESS, 330 server tests passing, frontend
  typecheck clean, connect bundle builds, banlist tests pass.
- **Refork verified on production** (board approved the test): SIGKILLed a live
  Connect worker — master logged "replacing it", a replacement bound its
  listeners, systemd never restarted the service (`MainPID` and
  `ActiveEnterTimestamp` unchanged), and the site served 200s throughout. Under
  the old behaviour that exact event would have restarted the whole service.
- **SSM agent noise fixed** (board supplied `AWS_PROFILE=smotana`): created a
  minimal `clearflask-ssm-agent-policy` and attached it to `cf-kb-role`.
  Deliberately NOT the AWS-managed `AmazonSSMManagedInstanceCore`, which would
  also have opened Session Manager as a remote-access path nobody asked for.
  294 errors in the prior half hour -> 0.
- BOARD ASKS still open: (1) **check Search Console** for coverage lost while
  `www` served 500s — the CEO cannot see that data; (2) render capacity cap —
  recommend leaving as is.
- LESSON (recorded, cost two false "build passed" claims): never read the exit
  status of a compound command. Write it to a file, or grep the tool's own
  success marker. Both of yesterday's local server builds had actually failed
  on a missing `clearflask-legal` artifact while being reported as clean.

## 2026-08-27
- **Production log triage** (board asked "check recent errors/warnings, fix and
  deploy"). Prod itself was healthy the whole time — no outage, no downtime.
  Five real defects found in the logs and fixed; deployed to the SaaS fleet.
- **www.clearflask.com returned HTTP 500 on every page** (P0, silent for who
  knows how long). The `www` redirect in `Main.tsx` returned a react-router
  `<Route>` before the `<Router>` was mounted, so it threw on every render —
  ~1,300 failed SSRs/day. Google saw a 500 across the whole marketing site and
  human visitors on `www` got a blank page. Now a real 301 to the apex domain,
  keeping the path. **The marketing site's SEO was quietly broken; worth
  checking Search Console for lost coverage.**
- **Connect crashed 65 times in 5 days**, each crash taking the entire worker
  cluster down (one dead worker calls `process.exit(42)`) and leaving systemd to
  restart the site. Cause: nothing listened for socket errors, so an ordinary
  client reset (abandoned TLS handshake, scanner hanging up) was an uncaught
  'error' event that killed the process. Fixed at the httpx demultiplexer, on
  all three listeners, and in the proxy's error handler.
- **32 MB/day of SEVERE log spam** — 5,241 stack traces on a normal day, all of
  them the same *handled* 404 for a deleted project. `ApiException` was left to
  escape the servlet so the container error page could answer it; Tomcat logs
  every escape at SEVERE first. Now mapped inside Jersey (identical response).
  Disk is at 70%, and real faults had nowhere to hide.
- **Unauthenticated 500 in `userBind`/`userCreate`** — `Optional.get()` on a
  missing project. Both are `@PermitAll`, so anyone could trigger it with any
  project id. Now returns 404 like the other project resources.
- Deployed in two rounds (both green): the first fix uncovered a second bug
  behind it — the renderer assembled a page body for redirects, and a redirect
  renders nothing, so i18next's `reportNamespaces` was undefined. Verified
  against prod after the second deploy: `www` now 301s to the apex with the path
  kept, SEVERE traces 5,241/day -> 0, worker deaths 65-in-5-days -> 0, cert log
  dumps -> 0, spurious render timeouts 1,527 -> 0. Apex SSR unchanged.
- NOT FIXED, flagged for the board:
  - **The cluster kills every worker when one dies.** That is deliberate
    (`// Kill entire cluster if one worker dies`), and it turns any single
    worker fault into a full site restart. Reforking the one worker instead
    would be the resilience fix, but changing process supervision is the
    board's call. Recommend doing it.
  - **~30 other `getProject(...).get()` call sites** on authenticated endpoints
    have the same 500-instead-of-404 shape. Left alone: a 30-site sweep is its
    own change, not a hotfix.
  - **Stale customer DNS**: former customers' custom domains (gozen.io,
    stonekick.com, snow-track.de and others) still point at us and 404 all day.
    Harmless now that it is quiet, but it is also a list of churned customers.

## 2026-07-18
- CORRECTION (board pushback): board flagged that the PikaPods/Elestio outreach
  channels were never verified (kaiwalya@elest.io had bounced; PikaPods silent).
  CEO re-researched from primary sources. Outcome: `hello@pikapods.com` and
  `support@elest.io` ARE genuinely listed on the respective sites (not
  hallucinated), but two better channels were being missed and one reference
  was wrong:
  - **PikaPods**: catalog additions are driven by their public request board
    feedback.pikapods.com (Fider, `app-request` tag). No ClearFlask request
    exists there. NEW BOARD ASK: post the drafted app-request (draft in
    `outreach/pikapods-draft.md`); email follow-up optional.
  - **Elestio**: `contact@elest.io` is their stated address for "partnership
    opportunities" (better than support@); their Discord
    (discord.gg/4T4JGaMYrD) is where catalog requests visibly happen. The
    previously referenced `elestio-examples` GitHub repo does NOT exist —
    removed from the draft. BOARD ASK: send to contact@elest.io.
  - Lesson recorded: verify submission channels from primary sources before
    drafting outreach around them.

## 2026-07-13
- SHIPPED: **"Deploy on Railway" button in the README** — new "One-click deploy"
  section at the top of Self Hosting linking railway.com/deploy/clearflask. The
  GitHub repo is our largest traffic source; deploys through the button earn the
  kickback.
- INVESTIGATED (closes the 07-08 follow-up): the **Railway 50% OSS promo is
  over** — it was a limited-time launch offer. The live program is 15% base +
  10% support bonus (25% max), automatic for published templates, nothing to
  enroll in. The +10% comes from answering user questions in the Template Queue
  (station.railway.com/my-template-queue) as they arrive. Payouts are Railway
  credits by default; cash opt-out on the Earnings page.
- NEW BOARD ASK: apply as a **Railway Open Source Partner**
  (railway.com/partners → "Become a partner") — grants a Verified badge +
  featured marketplace placement at the same rates. Suggested form answers in
  `specs/railway-template.md`.
- BOARD ASK (refreshed): **send the two outreach emails** — drafts updated
  2026-07-13 in `outreach/` to pitch the lean 3-container stack + live Railway
  listing: (1) PikaPods follow-up to hello@pikapods.com (silent since 07-03,
  follow-up was due 07-10); (2) Elestio to support@elest.io (first attempt
  bounced).
- P2 STARTED: codebase audit + spec drafted (`specs/ai-dedupe-digest.md`).
  Audit surprise: post merging and a weekly digest cron are ALREADY BUILT and
  running; LLM plumbing (LangChain4j/OpenAI) exists too. Net-new work is just
  the LLM duplicate-rerank layer + admin "suggested merges" surface + AI
  sections in the existing digest — no new infra, no vector DB in v1.
  BOARD ASK: review the spec, esp. gating (Business-tier on cloud / own API
  key on self-host; also plan-gate the existing ungated AI chat).

## 2026-07-08
- MILESTONE: **🚀 PUBLISHED — ClearFlask is live on the Railway marketplace:
  https://railway.com/deploy/clearflask** (board approved same day). First
  marketplace listing for the company; earns up to 25% usage kickback. Full
  overview copy on the listing (single-tenant, works on generated domain,
  ~50-word product blurb, use cases, dependencies). Category "Other" (closest
  available; no product-management category exists). Logo from clearflask.com.
- DONE per board instruction: test project "sunny-unity" deleted (48h grace;
  total re-test cost ~$0.20); stale localstack template 9geeXl deleted.
- FOLLOW-UP (CEO): Railway "Template Queue" questions earn a +10% support bonus —
  investigate; OSS 50% promo enrollment may need a separate application (BOARD
  may need to submit a form). Listing analytics visible under workspace
  Templates → Published ($ earnings tracker starts at $0.00).
- MILESTONE: **Railway template re-test PASSED on 2.6.3 — publish-ready.** Rebuilt
  template j5dQvf for single-tenant platform mode (connect ENV=platform, server
  JAVA_TOOL_OPTIONS baked in, volume widened to /opt/clearflask, healthcheck off,
  mariadb IPv6 start command verified) and deployed live (project "sunny-unity").
  All 3 services Online on FIRST TRY, no manual fixes. Verified on the live
  instance: /api/health ok; non-admin signup rejected; admin signup + project
  create OK; second project blocked; **portal serves on the generated
  up.railway.app domain (anonymous SSR)** — the old wildcard-subdomain blocker is
  fully resolved. No custom domain needed for a complete out-of-box experience.
- Board instructed (same day): "shut it down, publish and kill stale localstack
  templates" — all three executed (see MILESTONE above).

## 2026-07-06
- DECISION (board): **every release requires explicit per-release board approval.**
  No more releasing on CEO judgment (four releases had gone out in five days:
  2.5.0, 2.6.0, 2.6.1, 2.6.2). CEO brings the commit list + proposed version to
  the board and waits for a yes. Recorded in `ceo/CLAUDE.md` operating rules.
  Commit/push authority unchanged.
- DECISION (board): **version-bump convention corrected** — PATCH is the default
  for almost everything; MINOR is reserved for major user-facing features; the
  CEO had it backwards (minors for work that should have been patches). Rules
  updated in `ceo/CLAUDE.md`.
- APPROVED + SHIPPED: **release 2.6.3 (patch)** — board approved same day; workflow
  green, tag `2.6.3` cut, `ghcr.io/clearflask/clearflask-{server,connect}:2.6.3`
  published, Helm charts updated. Contents: exactly one feature commit `527bea61`
  (single-tenant platform mode), CI green and validated end-to-end locally before
  the ask (7-point check incl. UI, API caps, root-domain portal, restart
  durability — see minutes 2026-07-06).
- NEXT: rebuild Railway template on 2.6.3 images (ENV=platform on connect,
  JAVA_TOOL_OPTIONS on server, drop connect volume). Live re-test needs board
  spend approval; then the publish decision.
- DECISION (board): **never test via releases.** Release-free test loop documented
  in `ceo/CLAUDE.md`: local images + `make platform-up` for functional tests;
  throwaway `test-<sha>` GHCR tags for cloud-specific tests; one board-approved
  release at the end blessing tested code.
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
