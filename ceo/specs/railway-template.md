# Railway Template Spec — ClearFlask

_Status: ready to compose once the env-var feature (commit 87a4dd4a) is in a
released image. Compose in Railway's template builder; publish to marketplace;
enroll in open-source kickback._

## Prerequisite

The `CLEARFLASK_*` env-var support must be in the published `latest` (or a pinned
release) of `ghcr.io/clearflask/clearflask-server` and `clearflask-connect` —
i.e. cut a release after commit `87a4dd4a` before publishing the template.

## Services (4)

### 1. `clearflask-server` — image `ghcr.io/clearflask/clearflask-server:latest`
- Volume: `/opt/clearflask` (persists generated config + secrets across deploys)
- Env:
  - `CLEARFLASK_ENVIRONMENT=PRODUCTION_SELF_HOST`
  - `CLEARFLASK_CREATE_SERVER_CONFIG_IF_MISSING=1`
  - `CLEARFLASK_DOMAIN=${{clearflask-connect.RAILWAY_PUBLIC_DOMAIN}}`
  - `CLEARFLASK_AUTH_COOKIE_SECURE=true` (Railway edge terminates TLS)
  - `CLEARFLASK_CONNECT_TOKEN=${{shared secret — template variable, e.g. secret(32)}}`
  - `CLEARFLASK_SUPER_ADMIN_EMAIL=${{template prompt: your admin email}}`
  - `CLEARFLASK_MYSQL_HOST=${{mariadb.RAILWAY_PRIVATE_DOMAIN}}`
  - `CLEARFLASK_MYSQL_USER=root`
  - `CLEARFLASK_MYSQL_PASSWORD=${{mariadb.MYSQL_ROOT_PASSWORD}}`
  - `CLEARFLASK_DYNAMO_ENDPOINT=http://${{localstack.RAILWAY_PRIVATE_DOMAIN}}:4566`
  - `CLEARFLASK_S3_ENDPOINT=http://${{localstack.RAILWAY_PRIVATE_DOMAIN}}:4566`
  - S3 extras via `CLEARFLASK_EXTRA_PROPS` (multiline):
    ```
    com.smotana.clearflask.store.s3.DefaultS3ClientProvider$Config.dnsResolverTo=${{localstack.RAILWAY_PRIVATE_DOMAIN}}
    com.smotana.clearflask.store.impl.S3ContentStore$Config.proxyResolveTo=${{localstack.RAILWAY_PRIVATE_DOMAIN}}
    ```
    NOTE: S3ContentStore hostname/presign behavior with localstack over private
    networking is the one piece that needs a live test — see Open questions.
- No public domain (internal only). Healthcheck path: `/api/health` port 8080.

### 2. `clearflask-connect` — image `ghcr.io/clearflask/clearflask-connect:latest`
- Public domain enabled, **target port 9080** (Connect always serves plain HTTP
  there; Railway edge does TLS).
- Env:
  - `NODE_ENV=production`, `ENV=selfhost`
  - `CLEARFLASK_CREATE_CONNECT_CONFIG_IF_MISSING=1`
  - `CLEARFLASK_CONNECT_TOKEN=${{same shared secret as server}}`
  - `CLEARFLASK_DOMAIN=${{RAILWAY_PUBLIC_DOMAIN}}`
  - `CLEARFLASK_API_BASE_PATH=http://${{clearflask-server.RAILWAY_PRIVATE_DOMAIN}}:8080`
  - `CLEARFLASK_DISABLE_AUTO_FETCH_CERTIFICATE=true`
  - `CLEARFLASK_FORCE_REDIRECT_HTTPS=false` (edge handles it; avoids redirect loop)

### 3. `mariadb` — image `mariadb:10.5`
- Volume: `/var/lib/mysql`
- Start command: `mysqld --port=3306 --sql-mode=IGNORE_SPACE --explicit-defaults-for-timestamp --secure-file-priv=/tmp`
- Env: `MYSQL_ROOT_PASSWORD=${{secret()}}`

### 4. `localstack` — image `localstack/localstack:0.14.3`
- Volume: `/tmp/localstack`
- Env (mirror compose): `DEFAULT_REGION=us-east-1`, `SERVICES=dynamodb,ses,s3`,
  `LS_LOG=warn`, `START_WEB=0`, `USE_SSL=0`, `FORCE_NONINTERACTIVE=true`,
  `DATA_DIR=/tmp/localstack/data`, `LEGACY_PERSISTENCE=1`,
  `LOCALSTACK_HOSTNAME=${{RAILWAY_PRIVATE_DOMAIN}}`,
  `HOSTNAME_EXTERNAL=${{RAILWAY_PRIVATE_DOMAIN}}`

## LIVE TEST RESULT (2026-07-03) — template built, NOT published

Deployed from the template (Railway project "zippy-amazement"). Outcome:
- Template flow works end-to-end: 4 services provision, cross-service refs +
  `secret(32)` connect token resolve, volumes attach, super-admin email prompts
  the deployer. Public template page + deploy screen render correctly.
- **localstack + mariadb: Online.** **clearflask-server: hangs during startup**
  — Tomcat boots (no errors in logs), but app never finishes Guice init; healthcheck
  never passes; connect crash-loops waiting on it.
- **Diagnosis (open question #1/#2 confirmed):** server stalls initializing its
  S3/DynamoDB clients against localstack over Railway's **IPv6-only private
  network**. Our `DefaultS3ClientProvider` custom DNS resolver (`dnsResolverTo`)
  and localstack 0.14.3 don't resolve the private domain cleanly. NOT a template
  bug — a self-host networking assumption (localstack + custom DNS + IPv4).
- **Next step (code, not browser):** either (a) make the S3 client's DNS resolver
  IPv6-aware / bypass it when endpoint is a private host, or (b) drop localstack on
  Railway in favor of real DynamoDB+S3 via env (the env-var work already supports
  pointing at external endpoints), or (c) the lean-compose "local-disk storage +
  embedded Dynamo" variant from `../reports/marketplace-research-2026-07-02.md`.
  Option (c) is the durable fix and also unlocks PikaPods/Umbrel.
- Test project should be deleted to stop credit burn (BOARD).

## Open questions (resolve during live test)

1. S3 presigned-URL hostname with localstack behind Railway private networking —
   may need `S3ContentStore$Config.hostname` override in EXTRA_PROPS. Server-side
   proxying (`proxyEnabled=true`) should mask most of it.
2. Whether Railway's private domains resolve for the JVM DNS resolver used by
   `dnsResolverTo` (custom resolver in DefaultS3ClientProvider).
3. RAM: server wants ~2GB heap; pick plan guidance for the listing description.
4. Custom domains: user sets their domain on the connect service; `CLEARFLASK_DOMAIN`
   must then be overridden manually — document in template README.

## Listing copy (FINAL for publish — updated 2026-07-08, platform/single-tenant)

> **ClearFlask — open-source feedback management**
> Collect and prioritize user feedback with voting boards, roadmaps and
> changelogs. Open-source alternative to Canny and UserVoice. Deploys a
> self-contained stack — API server, SSR frontend and MariaDB — that works
> entirely on your generated Railway domain: sign up as the admin, create your
> project, done. Attach a custom domain any time.

Categories: Developer Tools / Product Management. 

## Publish checklist

- [x] Release cut containing env-var support; images tagged on GHCR (2.5.0…2.6.3)
- [x] BOARD: Railway account + template composed (CEO can drive via browser)
- [x] Live test deploy from the template — PASSED 2026-07-08 on 2.6.3 (platform
      single-tenant; first-try clean deploy; portal on generated domain)
- [x] Publish to marketplace — DONE 2026-07-08: https://railway.com/deploy/clearflask
      (stale 9geeXl deleted; kickback tracker live)
- [x] OSS 50% promo — investigated 2026-07-13: **promo is over** (limited-time
      offer). Current program: 15% base + 10% support bonus = 25% max; kickback
      is automatic for published templates, no enrollment. Credits by default;
      cash opt-out on the Earnings page ($100 min withdrawal).
- [ ] Answer Template Queue questions as they arrive
      (station.railway.com/my-template-queue) — earns the +10% support bonus
      automatically; no sign-up. Draft answers for board review before posting.
- [ ] BOARD: apply as **Railway Open Source Partner** (railway.com/partners →
      "Become a partner") — Verified badge + featured placement. Suggested form
      answers: project = ClearFlask, github.com/clearflask/clearflask
      (Apache-2.0, open-core, actively developed since 2019); template already
      published + live-tested at railway.com/deploy/clearflask; description =
      the listing's short description; contact = matus@smotana.com.
