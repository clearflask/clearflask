# Outreach draft — PikaPods (hello@pikapods.com)

_Status: DRAFT for board review. Matus sends from matus@smotana.com; never sent by CEO directly._

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
