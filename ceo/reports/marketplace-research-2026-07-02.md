# Self-Host Marketplace Research (2026-07-02)

Feeds P1. Headline: **ClearFlask is listed nowhere today; competitor Fider is on
PikaPods.** Two warm trails: a 2021 Cloudron wishlist thread (Matus already replied)
and a Railway user who tried and failed to deploy our compose file — demand exists,
an official template would capture it.

## Recommended order (solo founder, passive revenue + funnel)

1. **Railway template — effort S, do first.** Only fully self-serve channel.
   Kickback: 15% of usage base, +10% if we answer the Template Queue (25% total),
   payable in cash. Limited-time "$1M for Open Source" promo pays **50%** to OSS
   devs until the pool runs out — grab while it lasts. Multi-service templates from
   pre-built images are supported; our 4 GHCR/upstream images map directly. Wrinkle:
   Railway configures via env vars, not files.
   Sources: docs.railway.com/templates/kickbacks · railway.com/open-source-kickback
2. **PikaPods — S–M.** No self-serve; email hello@ / feedback board. They package it
   themselves given an official image + env docs. **20% revenue share** for author
   apps. Fider is already there from $1.80/mo — proves category demand.
   Sources: pikapods.com · docs.pikapods.com/faq/apps
3. **Elestio — S–M.** Partner by email (kaiwalya@elest.io per formbricks#1118).
   Compose-based (elestio-examples repo) — our stack maps almost directly.
   Revenue share negotiable: commonly ~20%; Rallly publicly gets **30%**.
4. **DigitalOcean Marketplace — M.** No revenue share either way; value is SEO/
   legitimacy/funnel. Requires a Packer-built Droplet snapshot (Docker + compose
   pre-pulled + first-boot script, like CapRover/Mastodon do) + review. Ongoing
   image maintenance per release.
5. **Umbrel + CasaOS/BigBear — S each.** PR-based compose listings, no pay,
   hobbyist audience; cheap brand reach once a lean compose variant exists.
6. **Later/skip:** Coolify (**blocked: needs 1,000+ GitHub stars; we have ~440**),
   Unraid (awkward for multi-container), Cloudron (single-container port, L effort,
   $0 revenue — only if a community packager volunteers; wishlist thread:
   forum.cloudron.io/topic/5915), AWS Marketplace (compliance-heavy, only for
   enterprise procurement later), Softaculous (PHP-centric, poor fit).

## Cross-cutting prep that unlocks nearly everything

Produce a **lean self-host variant that drops localstack** (local-disk file storage
instead of S3-emulation) so the stack is connect + server + MariaDB — three
well-known images. Single biggest packaging change; reduces effort on Railway,
PikaPods, Umbrel, CasaOS, Unraid. (See `packaging-audit-2026-07-02.md` — DynamoDB
is the harder half of the localstack dependency; needs an embedded/local answer.)

Also needed before listings (from packaging audit): first-boot secret generation
(currently all installs share hardcoded keys — advisory-grade), env-var config
support, README RAM guidance, bump localstack/mariadb pins.

## GitHub stars note

~440 stars. Star growth is itself a distribution lever (unlocks Coolify at 1,000).
The P2 relaunch (Show HN / Product Hunt) directly feeds this.
