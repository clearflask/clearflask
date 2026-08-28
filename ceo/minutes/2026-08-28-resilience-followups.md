# Minutes — 2026-08-28 — Resilience work + clearing the triage backlog

Present: CEO (Claude), board (Matus).

## Context

Board: "yeah continue and make it more resilient, fix up all the things you
found" — i.e. take the items the 2026-08-27 triage deliberately left open.

## Yesterday's fixes, measured after ~20 hours

| | before | now |
|---|---|---|
| Connect worker deaths | 65 in 5 days (~13/day) | **0** |
| `connect.service` failures | ~13/day | **0** |
| SSR "Failed to get page" | ~1,300/day | **0** |
| Tomcat SEVERE traces | 5,241/day (32 MB) | **0** (log is 3.3 KB) |
| "Render timeout" warnings | 1,527 | **0** |
| Cert-lookup log dumps | 26 lines each | **0** (quiet form, 247) |
| Successful SSR renders | — | 15,529 |

The application log (`clearflask.log`) is now **100% INFO** — no WARN, no ERROR.
Catalina's only warnings are Tomcat's boilerplate classloader messages emitted
at redeploy.

## Work done today

### Connect no longer takes the whole site down for one worker

`cluster.on('exit')` called `process.exit(42)` — by design, but it meant every
single-worker fault became a full site restart. That is what turned an
unhandled socket error into 65 outages last week.

Now the master forks a replacement. A crash-loop guard remains for the case the
old behaviour was really protecting against: ten deaths inside a minute means
the process cannot start at all (bad config, port already bound), so the cluster
stops and lets systemd restart it cleanly. A worker that exits because it was
asked to is not counted as a fault.

### Pre-handshake sockets are now bounded

Until the first byte arrives, no server owns the connection, so none of the
http/https timeouts apply to it. Holding sockets open and silent is the cheapest
way to tie up a server. 30-second first-byte timeout added at the demultiplexer.

### 404 instead of 500 for a project that does not exist (30 call sites)

Every remaining `getProject(...).get()` took the project out of its Optional
without checking, so any request naming an absent project died with
`NoSuchElementException` and a 500. All thirty now throw the same 404 the
project resources already used. This matters more now than it did last week:
with the handled-error flood gone from the SEVERE log, these would have been
the noise that replaced it.

### ErrorHandler encoding

The writer was taken before the content type and encoding were set, so the
response kept the container default and any non-ASCII in a user-facing message
reached the client mangled.

## Still open — board decisions, not code

- **Render capacity**: 209 requests in 14.5h hit the 16-concurrent-render cap
  and fell back to client-side rendering with a 503. That is ~1.3% of renders
  and the cap is doing its job — it is what stops a flood from OOMing the host,
  which is what caused the Aug 4 outage. Raising it trades that protection for
  memory headroom the box does not obviously have (2.4 GB of 3.8 GB in use).
  **Recommend leaving it**; revisit if the rate climbs.
- ~~**amazon-ssm-agent**~~ — DONE, see below.
- **Stale customer DNS**: former customers' custom domains still resolve to us
  and 404 all day (gozen.io, stonekick.com, snow-track.de, gettippedoff.com and
  others). Harmless now that the logging is quiet. It is also a churn list.
- **`www` SEO**: the marketing site served HTTP 500 on every `www` URL for an
  unknown period. Worth checking Search Console for lost coverage — the CEO
  cannot see that data.

## Board-approved actions taken

### The refork was tested on production, not just claimed

Board approved deliberately killing a worker to verify the fix. On the live
host: `sudo kill -9` one of the two Connect workers, then observed

- master logged `worker 18096 died (SIGKILL), replacing it`,
- a replacement came up (`Worker started #3`) and rebound its listeners,
- `MainPID` and `ActiveEnterTimestamp` were **unchanged** — systemd never
  restarted the service, which is the whole point of the change,
- the site served 200s throughout, and `www` kept 301ing.

Under the old behaviour this exact event took the entire site down.

### SSM agent noise fixed at the IAM level

Board supplied `AWS_PROFILE=smotana`. Created a **minimal** customer-managed
policy `clearflask-ssm-agent-policy` (`ssm:UpdateInstanceInformation`,
`ssm:ListAssociations`, `ssm:ListInstanceAssociations`) and attached it to
`cf-kb-role` — deliberately *not* the AWS-managed `AmazonSSMManagedInstanceCore`,
which would additionally have enabled Session Manager as a new remote-access
path to the box that nobody asked for.

After restarting the agent: `EC2RoleProvider Successfully connected with
instance profile role credentials`, and **zero** ERROR/WARN lines and zero
`AccessDeniedException` in the following minutes. Was 294 in the preceding
half hour.

## Verification

Genuinely checked this time, exit codes read from the build itself:

- `mvn install -DskipTests` across legal/api/logging/server: **BUILD SUCCESS**,
  275 sources compiled, WAR built.
- `mvn test -pl clearflask-server`: **330 tests, 0 failures**.
- Frontend typecheck: **0 errors in `src/`**. Connect bundle: builds clean.
  Banlist tests pass.

### Process correction carried over from yesterday

Yesterday's minutes recorded that a build check had reported success while the
build was failing, because the exit status read belonged to a trailing `echo`.
The same trap caught two more commands today — including a background build the
harness reported as "exit code 0" while the build itself had exited 1. Both
yesterday's server builds had in fact failed at a missing `clearflask-legal`
artifact (`-am` does not pull it in; it is referenced from plugin config, so it
must be named explicitly in `-pl`). The deployed code was fine — CI compiled it
and production proves it works — but the local check was worthless twice.

**Rule going forward: write the exit status to a file and read it, or grep the
tool's own success marker. Never trust the status of a compound command.**
