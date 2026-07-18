# Outreach — PikaPods

## Verified submission channels (researched 2026-07-18)

PikaPods documents no formal author-submission process. Verified channels:

1. **`hello@pikapods.com`** — the general contact listed on pikapods.com
   (verified 2026-07-18; this is where the 07-03 email went — address is
   legitimate, they're just silent).
2. **feedback.pikapods.com** — their public request board (a Fider instance)
   with a green **`app-request`** tag; catalog additions are visibly driven by
   requests + votes there. **No ClearFlask request exists yet** (checked via
   their API 2026-07-18). This is the higher-signal route: a public request
   creates community pressure an email can't.
3. Homepage states "20% revenue share with project authors where possible" —
   revenue share is negotiated once they decide to list, not applied for.

Plan: BOARD posts the app-request below on feedback.pikapods.com (needs an
account there), and optionally still sends the email follow-up. We can also
mention the request link in our own community/socials to gather votes.

## App-request post draft (for feedback.pikapods.com, tag: app-request)

**Title:** Add ClearFlask — open-source feedback management (Canny alternative)

I'm the author of ClearFlask (https://github.com/clearflask/clearflask,
Apache-2.0). It's feedback management — voting boards, roadmap, changelog — an
open-source alternative to Canny/UserVoice, and a feature-complete step up from
Fider which you already host.

It's a good fit for PikaPods: lean 3-container stack (API server + SSR
frontend + MariaDB, single persistent volume), all config via env vars,
secrets auto-generated on first boot, runs in ~1 GB RAM, works entirely on a
generated subdomain (single-tenant mode — no wildcard DNS needed). Already
live on the Railway marketplace with this stack:
https://railway.com/deploy/clearflask

Happy to adapt packaging to PikaPods' needs and interested in the author
revenue share. — Matus

_Status: **SENT 2026-07-03** by Matus to hello@pikapods.com (shortened version:
intro + "listed for revenue sharing, can provide packaging in the format you
need"). No reply as of 2026-07-13 — follow-up draft below, ready for board to
send._

## FOLLOW-UP draft (2026-07-13) — BOARD: review + send

**Subject:** Re: ClearFlask listing + revenue share — open-source feedback tool (author)

Hi PikaPods team,

Quick follow-up with news since my last email — ClearFlask now ships a
marketplace-ready deployment mode built exactly for platforms like yours:

- **Lean 3-container stack**: API server + SSR frontend + MariaDB. No more
  localstack — file storage is local-disk and the datastore is embedded, all
  persisting to a single volume.
- **Zero-config single-tenant mode**: works entirely on a generated subdomain
  (no wildcard DNS or custom domain needed) — admin signs up, creates their
  project, done. Signup is locked to the configured admin.
- All config via environment variables; secrets auto-generated on first boot;
  runs comfortably in ~1 GB RAM.

It's proven in production: we just launched on the Railway marketplace with this
stack (https://railway.com/deploy/clearflask, first-try clean deploys).

You host Fider in this category — ClearFlask is the feature-complete option for
teams that outgrow it, and I'd love to get it on PikaPods with revenue share.
Happy to adapt packaging to whatever format you need.

Best,
Matus Faro
https://clearflask.com

---

Original draft below for reference:

**Subject:** ClearFlask listing + revenue share — open-source feedback tool (author)

Hi PikaPods team,

I'm Matus, the author of ClearFlask (https://github.com/clearflask/clearflask) — an
open-source feedback management tool: voting boards, roadmap and changelog. It's an
alternative to Canny/UserVoice; you already host Fider in this category, and
ClearFlask is the more feature-complete option for teams that outgrow it.

I'd like to get ClearFlask listed on PikaPods and take part in your revenue-share
program for app authors.

What we provide:
- Official multi-arch images (amd64/arm64) on GHCR: `ghcr.io/clearflask/clearflask-server`
  and `clearflask-connect`, semver-tagged, with a `/api/health` healthcheck.
- Environment-variable configuration (domain, admin email, SMTP, DB, secrets) — no
  config-file editing needed for standard deploys.
- Install-specific secrets are generated automatically on first boot.
- Stack: server (Java) + SSR frontend (Node) + MariaDB + localstack (DynamoDB/S3
  emulation). I'm happy to work with you on packaging and to promote the PikaPods
  option in our README as the recommended hosted-for-you route.

Happy to answer anything and to adjust packaging to fit your setup.

Best,
Matus Faro
https://clearflask.com

---
_CEO note: adjust the localstack sentence if the lean-compose work lands first;
their strong preference is fewer containers._
