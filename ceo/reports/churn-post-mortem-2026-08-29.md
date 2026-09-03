# Churn post-mortem — where the lost custom-domain customers went

_2026-08-29. Method: 5 days of production access logs (the only window retained)
identified custom domains still sending `connect/cert` requests but no longer
resolving to a project. Each was then checked by DNS, live HTTP, and inspection
of the parent company's current site._

## Headline

**Nobody left for a competitor. One customer migrated; the rest simply stopped
using a feedback board at all.**

This was assumed to be competitive churn. It is not. Of 12 dead custom domains,
exactly **one** moved to another vendor, and **one** was not churn at all.

## The evidence

| domain | DNS today | verdict |
|---|---|---|
| feedback.snow-track.de | `custom-hostname.releasedhub.com` | **migrated to Released** |
| roadmap.intune-manager.com | still `sni.clearflask.com` | **not churn** — consolidated into `roadmap.robopack.com`, still a live customer |
| feedback.gettippedoff.com | Cloudflare, origin dead (525) | abandoned; **still embeds our widget** |
| roadmap.forms.gozen.io | Cloudflare, origin dead (525) | abandoned |
| ideas.altomarketing.com | Cloudflare, origin dead (525) | abandoned |
| roadmap.asset.ch | still `sni.clearflask.com` | abandoned, DNS left pointing at us |
| product.icligo.com | still `sni.clearflask.com` | abandoned |
| feedback.elvistender.com | still `sni.clearflask.com` | abandoned (site itself now unreachable) |
| features.aicoaches.live | still `sni.clearflask.com` | abandoned |
| clear.urbanentrepreneuruniverse.com | still `sni.clearflask.com` | abandoned |
| stonekick.com (×5 boards) | still `sni.clearflask.com` | abandoned |

Nine of twelve **never even repointed their DNS** — the signature of walking away
from the product, not of a migration. A customer who switches vendors updates the
CNAME. A customer who gives up leaves it.

Every parent company except elvistender.com is still trading. Their homepages were
checked for any feedback/roadmap/changelog link: **none of them run a public
feedback board today.** They did not replace us. They stopped.

## The one real competitive loss

**snow-track.de → Released** (`releasedhub.com`), now serving
`roadmap.snow-track.de`. One loss to one vendor is not a trend, but Released was
not on our competitive radar at all and should be.

## The one that is worth money today

**gettippedoff.com still has a `clearflask-feedback-button` on its live
homepage**, pointing at a board that no longer exists. Their visitors are
clicking our widget into a dead end. That is both a broken experience carrying our
name and the single warmest win-back on the list.

## What this means

The churned cohort shares one trait: **all of them were custom-domain users**, and
the cheapest plan unlocking a custom domain is **Cloud Starter at $6/mo**. So
churn is concentrated precisely in the tier `strategy.md` already says to kill
("Kill $5–10 tiers — low-price customers cost the most support per dollar").

The failure mode is not "Canny is better". It is **activation**: a small team
stands up a board, gets little engagement on it, and quietly abandons it. The
board goes quiet, then the plan lapses, then the DNS record sits there for months.

That reframes what to build. AI dedupe and digests make a *busy* board more
manageable. Not one of these customers had a busy board. Work that helps a new
board get its first real feedback beats work that summarises feedback nobody left.

## Recommended follow-ups

1. **Win back gettippedoff.com** — their live site still points at us (board: this
   needs a human to send; CEO can draft).
2. **Add Released to competitor tracking.**
3. **Get the Stripe MRR + churn timeline** — the logs give identity, not dates or
   dollars. Only the board can see this. Without it, churn *rate* is unknown.
4. **Reconsider the $6 Cloud Starter tier** — it is where the churn lives.
5. **Retention/activation deserves a slot above AI** in the backlog, pending the
   Stripe data.

## Method caveat

Tomcat access logs retain **5 days**. This cohort is "domains that were still
requesting certs in that window" — churn older than the DNS-abandonment window is
invisible here, and there is no date of departure for any of them. Treat the list
as a floor, not a census.
