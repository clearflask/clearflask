# Minutes — 2026-09-26 — Outage: Connect workers leaked into swap

Present: CEO (Claude), board (Matus).

## Context

Board: "Site is down, figure it out, and make it more resilient." Board granted
`ssh clearflask` for the investigation.

## What happened

`clearflask.com`, `feedback.clearflask.com` and every customer domain timed
out at the TCP level from outside — no TLS, no HTTP, nothing. The host itself
was up (SSH fine, 52 days uptime), Tomcat answered on 8080 locally, MariaDB
was running, and systemd reported `connect.service` active. Port 44380, where
the firewall redirects 80 and 443, accepted connections and never answered,
even from localhost.

Connect runs two workers on the two-core, 3.8 GB host. One worker had been up
for 38 hours and was at **1.5 GB RSS** at 100% CPU; swap was 1.1 GB in use.
The kernel log showed the pattern twice:

| | worker | RSS at kill |
|---|---|---|
| Sep 25 02:28 | 29511 | 1.66 GB |
| Sep 26 15:41 | 29518 | 1.83 GB |

Each time the master replaced the killed worker (the Aug 28 refork fix did its
job), but the *other* worker was on the same trajectory. A worker that is
GC-thrashing near the top of V8's default heap is still alive, still accepts
its share of connections from the cluster master, and answers none of them.
The OOM killer only steps in once the box has swapped itself to a standstill.

Measured from the Connect log (renders per minute): a scanner burst of
~300 renders/min from 15:36 to 15:45 (`.env`, `.git/config`,
`/proc/self/environ`, hundreds of paths against `administrator.clearflask.com`)
pushed the second worker over the edge at 15:40. Service was **degraded from
about 15:45** (a few renders a minute, one worker effectively gone) and
**fully down from 16:14 to 16:29 UTC**, when the CEO restarted
`connect.service`. External check afterwards: 200 on apex and customer boards.
Board was told by Telegram at 16:33.

## Why one restart was not the fix

Worker RSS grows steadily: the fresh workers start at ~290 MB and the killed
ones were at 1.6–1.8 GB after 1–2 days. That is a leak in the SSR path — every
render builds a store/extractor/stylesheet graph and something retains part of
it — and floods accelerate it. Finding the leak is the durable fix; until then
the process has to survive it.

## What changed

Four layers, each catching what the one above misses:

1. **Heap cap per worker** — `--max-old-space-size`, by default a fifth of
   system memory clamped to 384–1024 MB (768 MB on prod; `workerHeapMb` in
   the config or `CLEARFLASK_WORKER_HEAP_MB`). A worker that cannot free
   enough aborts in seconds and is replaced, instead of dragging the host
   through an hour of swap first.
2. **Graceful rotation before the cap** — each worker samples its own memory
   every 15 s and, at 75% of the heap limit on two consecutive samples (or
   RSS past 125% of it), asks the master to recycle it. The master forks the
   replacement first, waits for it to listen, then disconnects the old one;
   the old worker gives in-flight requests 30 s and exits. One rotation at a
   time so a flood cannot fork-storm the box. Every 10 minutes each worker
   logs its heap and RSS, so the leak rate is now measurable from the log.
3. **Liveness watchdog in the master** — an IPC ping every 10 s; a worker
   silent for 60 s is SIGKILLed and reforked. This is the layer that would
   have ended today's outage on its own: the stuck worker was alive but not
   running its event loop.
4. **Host watchdog outside the process** — a systemd timer probes
   `http://127.0.0.1:44380/robots.txt` every 30 s and restarts
   `connect.service` after three consecutive failures. It leaves a stopped
   service alone (that is a deploy). Installed on the live host now and added
   to `cf-ami-create.sh` for future hosts.

Layers 1–3 ship with the next deploy of Connect; layer 4 is already active.

## Verification

- Connect test suite: banlist tests all PASS, cluster smoke test `PASSED ALL`
  (exit 0 on both, read from the commands themselves).
- Frontend typecheck: 0 errors under `src/`; the only errors are pre-existing
  ones in third-party typings under `node_modules`.
- Watchdog on prod: timer listed, first run exit 0, failure counter at 0.

## Still open

- **The leak itself.** Now that workers log memory every 10 minutes, the next
  step is a heap snapshot of a worker at ~500 MB and a diff against a fresh
  one. Candidates: per-request i18next clones, `ChunkExtractor` instances,
  MUI `ServerStyleSheets`, Sentry transaction retention.
- **Scanner floods trigger full SSR renders.** `administrator.clearflask.com`
  is a real hostname under the wildcard, so the host-not-found cache does not
  apply, and every `/.env`-style path costs a two-pass render before it 404s.
  The banlist bans the source after 20 unique 404s, but a burst of 300/min
  from rotating addresses gets through. Worth a cheap pre-render 404 for
  paths that can never be a page.
- **The box is small.** Tomcat's 896 MB heap plus two capped workers is close
  to the 3.8 GB with no headroom for MariaDB and cache. Instance sizing is a
  board decision (it costs money).
