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
