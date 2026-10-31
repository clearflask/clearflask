# Subscriber notification batching fix — 2026-10-31

Present: Matus (board), engineering agent.

The board authorized fixing the production notification failure and deploying the
fix to the cloud SaaS. This does not authorize a versioned release.

A status/response update with more than 100 subscribers could exceed DynamoDB's
BatchGetItem key limit. The post update succeeded, but its subscriber notification
task failed before sending. User reads now deduplicate IDs and run batches of at
most 100 keys, preserving the existing unprocessed-key retry behavior and merging
all returned users. Missing users remain omitted.

Regression coverage exercises 1/100/101/250 users, empty input, duplicate IDs,
missing records, and a partial response requiring a retry across multiple batches.

Validation: full CI=true all-module clean install passed with 401 Java tests,
frontend UI regressions, production frontend/Connect compilation, and packaging.
Integration tests and local Docker image creation were skipped; CI builds the
production deployment artifacts.

Production deployment completed successfully via GitHub Actions run
[41201805031](https://github.com/clearflask/clearflask/actions/runs/41201805031),
shipping commit `a6d1043f`. The served backend version is
`20261031124633-2.7.1-SNAPSHOT`. Deployed `getUsers` bytecode confirms distinct IDs
partitioned into batches of 100. Live health returned HTTP 200. No new application
WARN/ERROR entries were observed in the immediate post-deployment check.

No customer post was changed to trigger notifications during validation. The
previously failed notification task is not automatically replayed by this fix.
