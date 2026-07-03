# Self-Host Packaging Audit (2026-07-02)

Feeds P1 (marketplace listings). Verdict: **not one-click-ready — ~70% there for
compose-savvy users; the architecture fights single-container marketplaces.**

## What we ship today

- Images on GHCR only (no Docker Hub): `ghcr.io/clearflask/clearflask-server` and
  `ghcr.io/clearflask/clearflask-connect`, `latest` + semver, amd64+arm64. Built via
  fabric8 docker-maven-plugin in `clearflask-release/pom.xml`; pushed by the
  manual-dispatch `release.yml` workflow. Helm charts published to
  `clearflask.github.io/clearflask`.
- Canonical compose: `clearflask-release/src/main/docker/compose/docker-compose.self-host.yml`.
  **4 mandatory containers**: server, connect, mariadb:10.5 (search), and
  localstack:0.14.3 (the only provided DynamoDB+S3+SES substitute — DynamoDB is the
  source-of-truth store; no embedded/dynamodb-local/minio option exists).
- Compose quirk: localstack is behind `--profile with-deps` but is mandatory; plain
  `docker-compose up` yields a broken stack.
- Config via two mounted files (Java properties keyed by class names +
  `connect.config.json`), auto-created on first boot. **No env-var configuration** —
  marketplace platforms can't configure via their standard env-injection UIs.
- First run on localhost genuinely one command; real deployment needs hand-editing
  ~15 properties across 2 files (domain, SMTP ×8, certs ×3, super-admin regex,
  flip `signupEnabled=false` after signup).
- Resources: no heap limits in server Dockerfile; Helm suggests server 2–4Gi/-Xmx2g,
  connect 512Mi–1Gi. Realistic compose stack minimum **~3–4 GB RAM**; README states
  no requirement.

## Blockers for one-click marketplaces (PikaPods/Cloudron/Railway)

1. **4-container topology, no all-in-one image.** Biggest gap = DynamoDB dependency,
   satisfiable only via 2022-era LocalStack. Fix options: all-in-one image
   (supervisor: Tomcat + Connect + dynamodb-local or DynamoDB-API shim) or pluggable
   KV store.
2. **No env-var config.** Fix: entrypoint script rendering config from
   `CLEARFLASK_*` env vars (domain, SMTP, super-admin email, secrets).
3. **Shared hardcoded secrets** — `config-selfhost.cfg` ships real working values
   every install inherits: VAPID keypair, cursor encryption key, JWT
   `tokenSignerPrivKey`, SSO `secretKey`, connect token, MySQL root password
   `clearflask`. Helm comments most out but still ships the VAPID keypair
   (`values-selfhost.yaml`). **Security-advisory-grade; fix regardless of
   marketplaces** — generate at first boot when unset.
4. Housekeeping: hardcoded Sentry DSN telemetry on by default
   (`web/Application.java:92`); JMX 9950/9951 exposed unauthenticated by default in
   compose + Dockerfile; ancient pins (localstack 0.14.3, mariadb 10.5 EOL,
   elasticsearch 7.10.0 EOL); `signupEnabled=true` default.

## Fixed already (2026-07-02)

- README quick-start said `admin@clearflask.com` but self-host template restricts
  super-admin to `^admin@localhost$` — corrected to `admin@localhost`.
- README telemetry opt-out key was wrong (`com.smotana.clearflask.Application` →
  actual `com.smotana.clearflask.web.Application`) — corrected.

## Good news

Multi-arch images, semver tags, `/api/health` healthcheck, auto-config on first
boot, auto-TLS via Let's Encrypt/Greenlock, solid Helm story — raw ingredients for
packaging all present.
