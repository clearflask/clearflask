# Outreach — Elestio

## Verified submission channels (researched 2026-07-18)

Corrections to earlier notes: `kaiwalya@elest.io` is dead (bounced 07-03), and
the previously referenced `github.com/elestio/elestio-examples` repo does NOT
exist (404; not in their GitHub org — earlier note was wrong). Verified
channels, decoded from elest.io/contact on 2026-07-18:

1. **`contact@elest.io`** — elest.io/contact lists it "for general inquiries,
   sales questions, and partnership opportunities" → **best address for this**.
2. **`support@elest.io`** — also on the contact page (support-oriented).
3. **Discord: https://discord.gg/4T4JGaMYrD** — their blog says new catalog
   software is driven by requests from Discord + YouTube comments (~10
   additions/month). Good follow-up channel if email is slow.
4. Ticket system (requires an account).

Their about page confirms the program: "We share revenue with open-source
authors participating in our program" (publicly cited at ~20%; Rallly gets 30%
— anchor there, accept >=20%). No application form exists — it starts as a
conversation.

_BOARD ASK: send the draft below to **contact@elest.io** (CEO can't send).
If no reply in ~1 week, post a short version in their Discord._

## UPDATED draft (2026-07-13) — BOARD: review + send to contact@elest.io

**Subject:** Adding ClearFlask to the Elestio catalog (open-source author, revenue share)

Hi Elestio team,

I'm Matus, author of ClearFlask (https://github.com/clearflask/clearflask), an
open-source feedback management platform — voting boards, roadmap, changelog; an
alternative to Canny/UserVoice (Apache-2.0, actively developed since 2019).

I'd like to get ClearFlask into the Elestio catalog and set up your open-source
revenue-share partnership.

We're docker-compose-native and marketplace-proven — we just launched on the
Railway marketplace (https://railway.com/deploy/clearflask):

- Lean compose stack: API server (Java) + SSR frontend (Node) + MariaDB —
  official platform compose file at
  https://github.com/clearflask/clearflask/blob/master/clearflask-release/src/main/docker/compose/docker-compose.platform.yml
  (a fuller self-host variant with external search/storage also exists).
- Official images on GHCR, semver-tagged, `/api/health` healthcheck.
- Full environment-variable configuration (domain, admin email, SMTP, DB) and
  automatic per-install secret generation on first boot.

Happy to prepare the integration in whatever template format you use and to
promote Elestio in our README as a managed-hosting option. Could you share the
terms of your revenue-share program for participating authors?

Best,
Matus Faro
https://clearflask.com

---

Original draft below for reference:

**Subject:** Adding ClearFlask to the Elestio catalog (open-source author, revenue share)

Hi Kaiwalya,

I'm Matus, author of ClearFlask (https://github.com/clearflask/clearflask), an
open-source feedback management platform — voting boards, roadmap, changelog; an
alternative to Canny/UserVoice (Apache-2.0, actively developed since 2019).

I'd like to get ClearFlask into the Elestio catalog and set up your open-source
revenue-share partnership.

We're docker-compose-native, which I believe maps directly onto your model:
- Compose stack: API server (Java) + SSR frontend (Node) + MariaDB + localstack —
  official file at
  https://github.com/clearflask/clearflask/blob/master/clearflask-release/src/main/docker/compose/docker-compose.self-host.yml
- Official multi-arch images on GHCR, semver-tagged, `/api/health` healthcheck.
- Full environment-variable configuration (domain, admin email, SMTP, DB) and
  automatic per-install secret generation on first boot.

Happy to prepare the integration template against your elestio-examples format and
to promote Elestio in our README as a managed-hosting option. Could you share the
terms of your revenue-share program for participating authors?

Best,
Matus Faro
https://clearflask.com

---
_CEO note: Rallly publicly gets 30% — anchor negotiation there, accept >=20%._
