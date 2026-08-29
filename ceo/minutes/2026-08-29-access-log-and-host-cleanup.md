# Minutes — 2026-08-29 — Access-log review, host cleanup, residual crash fixed

Present: CEO (Claude), board (Matus).

## Context

Board challenged the outage claim ("i dont think the website was down"), then
"anything left? continue". The correction is recorded in the 08-28 minutes and
the board log. This session covers what the challenge exposed: the CEO had never
looked at the one log that actually measures user experience.

## The gap the board's pushback exposed

Three days of triage had gone by without anyone reading the **access log**. It
is the only source that says what users received. Reading it now:

| day | requests | 5xx | 4xx |
|---|---|---|---|
| 2026-08-26 | 27,010 | **0** | 6,637 |
| 2026-08-27 | 29,694 | **1** | 2,125 |
| 2026-08-28 | 26,862 | **0** | 5,352 |
| 2026-08-29 | 22,883 | **0** | 2,698 |

The single 5xx in four days was the CEO's own probe:

```
POST /api/v1/project/nonexistent-abc123/bind HTTP/1.1 500 ... curl/8.21.0
```

This reinforces the board's point. The API tier has been returning clean
responses throughout. The 5,241 SEVERE traces a day were purely a **logging**
defect — clients always got their correct 404. And the `userBind` 500, while a
real bug on an unauthenticated endpoint, had never once been triggered by an
actual user in the observed window.

**Lesson: read the access log first.** It is the shortest path from "the logs
look alarming" to "here is what users actually got". Server-side error logs
measure how loudly a system complains, not what it delivered.

## The refork fix proved itself in production, unprompted

At 10:28:10 today a worker died for real — not the CEO's test:

```
Connect: worker 24220 died (1), replacing it
Connect: Rendered https://product.clearflask.com/embed-status/post/... in 2 pass(es)
```

Rendering continued **in the same second**, and `ActiveEnterTimestamp` never
moved. Under the previous behaviour this would have been a whole-service restart
and ~10 seconds of refused connections. This is better evidence than the
deliberate SIGKILL test, because nobody arranged it.

## What killed that worker — fixed

The new logging made the cause visible: an `/embed-status/post/...` render for a
post the viewer could not read threw `Permission denied` inside
`PostStatus.fetchData`, and nothing was listening.

`Promised` subscribes to its promise **only outside SSR** — server-side there is
no second render to update, so it deliberately skips it. That leaves the
rejection unclaimed, and connect runs with `--unhandled-rejections=strict`, so
node ends the process. Every one of `Promised`'s four callers had this exposure,
not just `PostStatus`.

Fixed in `Promised` (covers all callers) and again in `PostStatus` at the point
the promise is created, so it holds whether or not a render consumes it.

## Host cleanup — two dead cron jobs

### killbill-cleanup: 319 failures, zero successes, ever

`/usr/local/bin/killbill-cleanup.sh` ran every 30 minutes and logged
`ERROR: MySQL service is not running` every single time. Two things were wrong:

1. It guarded on `systemctl is-active mysqld`/`mysql`, but this host runs
   **mariadb** — so it exited before doing anything, always.
2. Fixing that check would not have helped: there is **no `killbill` database**
   on this host and no KillBill webapp deployed. It was decommissioned in the
   Stripe migration. The script has been dead since before this log began.

Not in the repo — an ad-hoc host script. Backed up to
`/root/decommissioned-2026-08-29/` and removed (cron, script, logrotate config).

### /etc/cron.d/clearflask: malformed, never executed

```
0 4 * * * service connect restart
0 4 * * * service tomcat restart
```

Entries in `/etc/cron.d/` require a **user field**; cron read `service` as the
username and failed with `getpwnam()` twice daily, every day. So the intended
nightly restarts never happened.

Deliberately **removed rather than repaired**. Tomcat is already restarted
nightly by `/etc/cron.daily/tomcat_restart` (this is what runs at ~03:17), so
repairing it would have added a redundant second Tomcat restart at 04:00 plus a
connect restart costing ~10 seconds for no benefit — connect has been stable and
does not need one. Removing a job that has never once executed changes no
behaviour; it only stops the error. Backed up alongside the other.

## Render timeouts — explained, benign

21 "Render timeout" warnings today, all between 03:17:19 and 03:17:36, and
Tomcat logged `Stopping service [clearflask]` at 03:17:03. They are SSR renders
waiting on an API that was in its nightly restart. Nothing to fix; noted so the
next reader does not chase them.

## Verification

- Frontend typecheck: **0 errors in `src/`**; connect bundle **REAL_EXIT=0**.
- Deployed via `deploy-restart-no-it.yml`.
- Access log: 0 5xx. Application log: 100% INFO. Tomcat SEVERE: 0.

## Still open for the board

- **Search Console** — coverage lost while `www` served 500s. Only the board can
  see this.
- **Render capacity cap** — recommend leaving as is (see 08-28 minutes).
- **Stale customer DNS / churn list** — gozen.io, stonekick.com, snow-track.de,
  gettippedoff.com and others still point at us. A business follow-up, not an
  engineering one.
