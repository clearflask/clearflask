# Outreach — PikaPods (hello@pikapods.com)

_Status: **SENT 2026-07-03** by Matus (shortened version: intro + "listed for
revenue sharing, can provide packaging in the format you need"). No reply as of
2026-07-13 — follow-up draft below, ready for board to send._

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
