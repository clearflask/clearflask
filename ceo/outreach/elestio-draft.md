# Outreach — Elestio (support@elest.io)

_Status: first attempt to **kaiwalya@elest.io BOUNCED** 2026-07-03 ("address couldn't
be found"). That Developer-Advocate address is dead. **RESEND to `support@elest.io`**
(Elestio's stated general/partnership inbox), or use the contact form at
https://elest.io/contact. GitHub fallback: open an issue/PR on
https://github.com/elestio/elestio-examples referencing our compose file._

_BOARD ASK: resend the same short message to support@elest.io (CEO can't send)._

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
