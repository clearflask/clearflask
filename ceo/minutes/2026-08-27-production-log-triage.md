# Minutes — 2026-08-27 — Production log triage

Present: CEO (Claude), board (Matus).

## Context

Board: "can you check the recent errors/warnings and see if there are fixes that
need to be done" — then "fix things, deploy things, let me know how you did. If
production goes down, telegram me."

Board granted standing SSH read access to the prod host for this work.

## Health at the start

Prod was healthy and stayed healthy throughout: `clearflask.com` 200 in 0.26s,
`/api/health` "ok", load 0.5, 1.9 GB free, swap barely touched (the Aug 4
thrash is resolved), disk 70%. No outage occurred, so no Telegram was sent.

## Findings

Sources: `/var/log/tomcat/{localhost,clearflask,catalina}*.log`,
`/var/log/clearflask-connect.log`, `/var/log/messages`.

### 1. www.clearflask.com returned HTTP 500 on every page (P0)

Reproduced live before the fix: apex served 109 KB of SSR HTML at 200; `www`
served 11.5 KB at **500**, as did `/pricing` and `/features`.

`Main.tsx` handled the www→apex redirect by returning `<RedirectIso>`, which
renders a react-router `<Route>` — but it returns *before* the `<Router>` below
it is mounted. Every render threw "You should not use `<Route>` outside a
`<Router>`". That is the `Invariant failed` behind ~1,300 SSR failures/day.

Two consequences beyond the error count: Google saw a 500 across the entire
marketing site, and a visitor landing on `www` got a blank page, because the
throw happens before the `ErrorBoundary` is mounted.

Fixed by setting the redirect on the SSR static-router context directly and
letting the browser handle it in CSR — the target is a different origin, which
react-router cannot navigate to anyway. Now 301, and the path/query survive
instead of dumping the visitor on the homepage.

**Follow-up for the board: check Search Console for coverage lost while the
marketing site was serving 500s.**

### 2. Connect crashed 65 times in 5 days (P0)

`connect.service` exited with status 42 — 5 times Aug 23, 48 on Aug 24, 6 on
Aug 25, 2 on Aug 26, 4 on Aug 27 — each time restarted by systemd. Every crash
was preceded by `Error: read ECONNRESET at TCP.onStreamRead`.

Nothing listened for socket errors. `httpx.js` owns the raw socket until it
hands it to the http or https server, and a client that hangs up before
finishing its first write — an abandoned TLS handshake, a scanner moving on —
makes that socket emit `'error'`. Node throws an `'error'` event with no
listener, and one dead worker calls `process.exit(42)`, so a single reset
restarted the whole service.

Fixed at the demultiplexer, on all three listeners, and in the proxy's error
handler (which always replied with `writeHead` — that throws for WebSocket
upgrades, where the argument is a socket, and after headers are already sent).
Also: a socket whose first byte is neither TLS nor HTTP was never adopted and
never closed — now destroyed.

### 3. 32 MB/day of SEVERE log spam (P1)

5,241 SEVERE stack traces on Aug 26, and 100% of them were the same *handled*
404, "Project does not exist or was deleted by owner". `ApiException` was left
to escape the servlet so the container error page could turn it into a
response; Tomcat logs every escape at SEVERE with a full trace first.

Mapped inside Jersey instead (same status, same body, no escape). `ErrorHandler`
still covers anything thrown outside Jersey. SEVERE now means a real fault
again — which matters with disk at 70%.

### 4. Unauthenticated 500 in userBind/userCreate (P1)

Found by probing during the triage, not from the logs. Both call
`getProject(...).get()` on an `Optional`, so any request naming a project that
does not exist died with `NoSuchElementException` → 500. Both are `@PermitAll`
— reachable unauthenticated with any project id. Now 404, like the other
project resources.

### 5. Spurious "Render timeout" warnings (P2)

1,527 of them. A failed render skips the assignment marking it finished, so the
still-pending 10s timer logged a timeout for a request that had already failed
and been answered. Nearly all of them were finding #1 reported a second time.

## Not fixed — board decisions wanted

- **The cluster kills every worker when one dies.** Deliberate (`// Kill entire
  cluster if one worker dies`), and it turns any single worker fault into a full
  site restart. Reforking the one worker is the resilience fix; changing process
  supervision is the board's call. CEO recommends doing it.
- **~30 other `getProject(...).get()` call sites** on authenticated endpoints
  share finding #4's shape. A 30-site sweep is its own change, not a hotfix.
- **1,527 SSR renders were also genuinely slow** in aggregate and 387 requests
  hit the concurrency cap and fell back to CSR. Fixing #1 removes ~1,300 wasted
  renders per day; worth re-measuring after this deploy before investigating.
- **amazon-ssm-agent** logs 247 credential errors/day — the instance role lacks
  `ssm:UpdateInstanceInformation`. Harmless, purely noise; either grant it or
  disable the agent.
- **Stale customer DNS**: former customers' custom domains (gozen.io,
  stonekick.com, snow-track.de, gettippedoff.com and more) still point at us and
  404 all day. Harmless now that it is quiet — but it is also a list of churned
  customers.

### 6. Redirects assembled a page body they had no use for (found mid-deploy)

Fixing #1 revealed a second bug behind it. The renderer runs its page
post-processing unconditionally, and a redirect renders no components, so
nothing had asked i18next for a translation and `reportNamespaces` was
undefined. `www` went on returning 500 after the first deploy — same symptom,
new cause. Redirects now answer with the `Location` and stop, and an absent
`reportNamespaces` is tolerated.

## Verification & deploy

Deployed in two rounds via `deploy-restart-no-it.yml`, both green
(runs 33114938435 and 33116225738). Prod stayed up throughout.

Confirmed against production after the second deploy:

| | before | after |
|---|---|---|
| `www.clearflask.com/`, `/pricing`, `/features` | 500 | 301 → apex, path kept, 200 on follow |
| Tomcat SEVERE traces | 5,241/day | 0 |
| `userBind` on a missing project | 500 | 404 + correct `userFacingMessage` JSON |
| Connect worker deaths | 65 in 5 days | 0 |
| Cert-lookup log dumps | 26 lines each | 0 |
| Spurious render timeouts | 1,527 | 0 |

Apex SSR unchanged (200, 109 KB) and `/api/health` ok.

### Process note for the CEO

The first deploy went out on a connect bundle that had never actually built
locally: the build command ended in an `echo`, so the exit status read was the
echo's, not the build's. The build was failing on a Node/OpenSSL 3
incompatibility (needs `--openssl-legacy-provider`; CI is unaffected). CI caught
nothing because the code was in fact fine — but the local check was worthless
and reported as if it had passed. **Check the exit status of the thing being
tested, not of the last command in the chain.**
