# Lean Self-Host Variant — Implementation Spec

_Board-approved 2026-07-03. Drop the localstack container; stack becomes
server + connect + MariaDB. Unlocks Railway + PikaPods + Umbrel + CasaOS._

localstack today provides DynamoDB (source-of-truth store), S3 (file content), and
SES (email — already replaceable by SMTP via config). So two real swaps.

## Good news up front
Both swaps are tractable because the abstractions are clean, AND the repo **already
bundles AWS's embedded DynamoDB + sqlite4java native libs for all platforms** and has
a working embedded provider that the entire test suite already runs against.

## Swap 1 — S3 → local-disk (effort: S)
- Clean interface `store/ContentStore.java` (upload/uploadAndSign, signUrl,
  parseContentUrl, proxy, delete*). Only impl today is `store/impl/S3ContentStore.java`.
- Self-host already runs in **proxy mode** (`proxyEnabled=true`): `signUrl()` returns a
  server URL `/api/v1/project/{projectId}/content/proxy/...`, and `ContentResource`
  (`web/resource/ContentResource.java`) → `contentStore.proxy()` streams bytes back.
  A local-disk store reuses this exact serving path.
- Build `LocalDiskContentStore implements ContentStore`: write/read files under
  `{baseDir}/img/ugc/{projectId}/{userId}/{fileName}`, serve via the existing proxy
  endpoint, delete via filesystem. Add `.module()` + switch the binding at
  `ServiceInjector.java:236`; mount a Docker volume for baseDir.
- Watch: content-type/cache headers, **path-traversal safety on fileName**, matching
  the existing proxy-URL regex.

## Swap 2 — DynamoDB → embedded DynamoDBLocal (effort: M)
- All Dynamo access goes through a single injected `AmazonDynamoDB` (AWS SDK v1) +
  `io.dataspray.singletable.SingleTable`. It's **one physical table + 2 GSIs**, created
  programmatically on startup (`SingleTableProvider.serviceStart()` →
  `createTableIfNotExists`, already enabled by self-host config). ~63 entity types
  multiplexed into that one table — no per-entity CreateTableRequest sprawl.
- `com.amazonaws:DynamoDBLocal` 1.12.0 + all-platform sqlite4java native libs are
  ALREADY declared (currently `test` scope). `test/.../InMemoryDynamoDbProvider.java`
  already binds `AmazonDynamoDB` via embedded DynamoDB and the whole suite runs on it —
  proving the drop-in works.
- Build: promote DynamoDBLocal/sqlite4java to runtime scope; add
  `EmbeddedDynamoDbProvider` for `PRODUCTION_SELF_HOST`; switch binding at
  `ServiceInjector.java:232`; set `sqlite4java.library.path` in the container; strip the
  Dynamo `serviceEndpoint` from self-host config. Zero changes to the 15 stores or the
  schema.

## BIGGEST RISK — Dynamo durability
`DynamoDBEmbedded.create()` (what the test provider uses) is **in-memory only** — data
lost on restart. For a source-of-truth store that's unacceptable. Must run the
**file-backed** variant (DynamoDBLocal `-dbPath -sharedDb`, a sqlite file on a mounted
volume). That file becomes the crown-jewel datastore: single-writer, single-instance,
needs backups. Getting persistence + volume + restart-survival right is where Swap 2's
real effort/risk lives. Secondary: DynamoDBLocal's engine isn't 100% identical to real
DynamoDB at scale, but the passing test suite de-risks the access patterns actually used.

## DESIGN CHANGE (board, 2026-07-03): platform-hosting is its own deployment type
Do NOT make the lean stack an option within self-hosting — existing self-hosters run
real DynamoDB/S3 and don't want file-based storage. Instead the lean stack is a NEW
deployment type **PRODUCTION_PLATFORM** (env `CLEARFLASK_ENVIRONMENT=PRODUCTION_PLATFORM`)
for one-click marketplace deploys. It behaves exactly like PRODUCTION_SELF_HOST
(SelfHostBilling/PlanStore, DNS skip, config bootstrap, licensing, x-forwarded-for,
Castle disabled) EXCEPT it uses LocalDiskContentStore + EmbeddedDynamoDbProvider.
Implemented via a new enum value + `Environment.isSelfHostLike()` helper.

## STATUS — application layer DONE (uncommitted WIP), packaging remains
Written this turn (all uncommitted, mid-feature):
- `store/impl/LocalDiskContentStore.java` — Swap 1 impl (done earlier).
- `store/dynamo/EmbeddedDynamoDbProvider.java` — Swap 2 impl: **file-backed** DynamoDB
  Local via in-process `DynamoDBProxyServer` (`-dbPath -sharedDb -port`), NOT the
  in-memory `DynamoDBEmbedded.create()`. Persists to `/opt/clearflask/dynamo` volume.
- `core/ServiceInjector.java` — added `PRODUCTION_PLATFORM` + `isSelfHostLike()`; branch
  Dynamo/S3/content bindings on platform; config path → `config-platform.cfg`; imports.
- `resources/config-platform.cfg` — platform template (no localstack endpoints).
- `util/AutoCreateKikConfigFile.java` + `util/SelfHostConfigBootstrap.java` — handle
  PRODUCTION_PLATFORM (secret gen + env-var config apply for platform too).
- Widened self-host branches to `isSelfHostLike()`: IpUtil, CastleAntiSpam,
  AccountResource (×2), AccountStore, CommonPlanVerifyStore (×2).
- `clearflask-server/pom.xml` — promoted DynamoDBLocal + sqlite-jdbc + sqlite4java +
  libsqlite4java-linux-amd64 from `test` to compile/runtime scope.

## REMAINING (needs a build+run loop — the fiddly part)
1. **Docker native lib**: server image must have the sqlite4java `.so` on disk and
   `sqlite4java.library.path` (default `/opt/clearflask/native-libs`) pointing at it.
   server.Dockerfile (`tomcat:9.0-jdk17-temurin`) needs the linux-amd64 `.so` staged in
   (mirror the bouncycastle staging pattern in clearflask-release), OR bundle+point at
   WEB-INF/lib. Validate the lib name matches what sqlite4java expects.
2. **arm64 CONSTRAINT (flag to board)**: sqlite4java native libs exist only for
   linux-amd64 (no linux-arm64 in the dep list). So the **platform image must be
   amd64-only**. Our current images are multi-arch. Railway/most marketplaces run
   amd64, so acceptable — but the platform tag should be built amd64-only, or find an
   arm64 sqlite4java build.
3. Lean **platform compose** file (server + connect + MariaDB; volumes for
   /opt/clearflask/dynamo, /opt/clearflask/content, and connect config;
   `CLEARFLASK_ENVIRONMENT=PRODUCTION_PLATFORM`; no localstack).
4. **Durability test**: deploy, create data, restart the server container, confirm data
   survives (the whole point of file-backed vs in-memory).
5. Update Railway template to `PRODUCTION_PLATFORM` + drop localstack service; re-test; publish.
6. Build validation via CI (local build blocked by protoc arch + user prefers CI).

## DURABILITY TEST ATTEMPT 1 (2026-07-03) — found 2 real issues, fixing
Ran the 2.6.0 platform image locally (docker, amd64 emulation on arm64 Mac). Findings:
1. **Confirmed working**: SelfHostConfigBootstrap generated fresh secrets; env-var
   overrides applied; EmbeddedDynamoDbProvider reached "Initializing DynamoDB Local,
   DbPath: /opt/clearflask/dynamo".
2. **SecretsGuard blocks default connectToken** (correct security behavior, not a bug):
   the published-placeholder connectToken is rejected in production. Platform must
   supply CLEARFLASK_CONNECT_TOKEN. Fixed docker-compose.platform.yml to require it on
   both server + connect (marketplace templates already inject it, e.g. Railway
   secret(32)). NOTE: self-host has the same guard — operators must set a fresh token
   (README already instructs uuidgen).
3. **BUG — native lib missing**: `sqlite4java cannot find native library`. The
   Docker-context staging (release pom copy + Dockerfile ADD) put the .so in
   docker-root-server/native-libs but it did NOT end up in the published image (a
   release:prepare-vs-perform checkout/phase ordering issue). **FIX: bundle the .so
   inside the WAR** (WEB-INF/classes/native-libs) and extract at runtime in
   EmbeddedDynamoDbProvider — removes all image-staging fragility. Reverted the release
   pom copy + Dockerfile ADD. Validating the WAR contains the .so locally before
   re-releasing (2.6.1, patch — fixes the just-shipped 2.6.0 platform feature).

## Plan / order + STATUS (updated 2026-07-03)
1. Swap 1 (LocalDiskContentStore) — **CODE WRITTEN (uncommitted WIP)**:
   `store/impl/LocalDiskContentStore.java`. Mirrors S3ContentStore's contract (same
   KEY_PREFIX, same two URL regexes, same proxy-endpoint serving path). Stores files
   under `{baseDir}/img/ugc/{proj}/{user}/{file}`; `signUrl` always returns the proxy
   URL; `proxy()` reads from disk and ignores xAmz params; path-traversal guarded
   (SAFE_SEGMENT + normalize/startsWith base). NOT yet wired into ServiceInjector.
   REMAINING for Swap 1: (a) switch binding at `ServiceInjector.java:236` to choose
   LocalDisk vs S3 by env/config flag (default S3 for AWS/prod, LocalDisk for a new
   self-host "lean" flag); (b) unit test mirroring any S3ContentStore test; (c) mount
   a Docker volume for baseDir in the lean compose.
2. Swap 2 (EmbeddedDynamoDbProvider, **file-backed** — NOT `DynamoDBEmbedded.create()`
   which is in-memory) — the careful one; prove restart durability. Not started.
3. Lean self-host compose (no localstack) + config; Docker native-lib path
   (`sqlite4java.library.path`). Not started.
4. Re-test the Railway template against the lean stack; then publish. Also feeds
   PikaPods/Elestio replies.

Commit discipline: this is feature WIP — commit the lean variant as one coherent,
build-green, tested unit, not piecemeal.

## Key files
- `store/ContentStore.java`, `store/impl/S3ContentStore.java`, `store/s3/DefaultS3ClientProvider.java`
- `web/resource/ContentResource.java`
- `store/dynamo/DefaultDynamoDbProvider.java`, `store/dynamo/SingleTableProvider.java`
- `test/.../store/dynamo/InMemoryDynamoDbProvider.java` (base the self-host provider on this)
- `core/ServiceInjector.java` (binding swap points ~232, 233, 236, 262)
- `resources/config-selfhost.cfg` (strip localstack endpoints)
- `clearflask-release/.../docker-compose.self-host.yml` (remove localstack; add volumes)
- `pom.xml` / `clearflask-server/pom.xml` (promote DynamoDBLocal + sqlite4java from test scope)
