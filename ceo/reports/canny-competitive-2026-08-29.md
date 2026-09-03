# Canny competitive read — and what it does to the P2 AI plan

_2026-08-29. Board asked for a look at Canny specifically ("our best biggest
competitor, likely AI usage may be a good value feature tradeoff"). Sources:
canny.io/pricing, canny.io/features/autopilot, plus four independent pricing
write-ups cross-checked against each other._

## The finding that changes P2

**Canny gives its AI away on the free plan.** Autopilot — feedback capture,
**deduplication**, automatic triage, smart replies, comment summaries, theme
analysis — is included on *every* tier including $0, with no stated usage cap.

`specs/ai-dedupe-digest.md` proposes gating AI dedupe behind the Business tier on
cloud. **That is now backwards.** The market leader has made dedupe table stakes
and priced it at zero. Selling as a premium upsell what Canny bundles free is a
losing position, and it would read badly on a comparison page — the exact pages
being built this session.

## Canny's actual pricing shape

| tier | price | gate |
|---|---|---|
| Free | $0 | **25 tracked users** |
| Starter | ~$19/mo (annual) | limited integrations |
| Pro | $79/mo (annual) | PM integrations, SSO-lite, custom domain, whitelabel |
| Business | custom (reported $948–$10k+/yr) | 5,000+ tracked users, SSO, CRM |

**"Tracked users" is the meter, and it is the whole story.** A tracked user is
anyone who creates, votes on, or comments on a post. So the meter counts exactly
the thing a successful feedback board produces: engagement. Run a board well and
your bill goes up. This is the mechanism behind the "$0 to $400+ fast" complaint
in `strategy.md`, and it is confirmed.

## Where the real moat is (and it is not dedupe)

Autopilot's defensible part is **ingestion**, not summarisation: it reads Intercom,
Zendesk, Gong, Help Scout, Freshdesk, Zoom, and public reviews on G2, Capterra,
Trustpilot, the App Store and Google Play, then turns support conversations into
structured feature requests. Their published claim is 93% accuracy over 1,725
Typeform tickets, capturing 30% more than the team did by hand.

Dedupe is the commodity. **Getting feedback in without anyone typing it** is the
capability worth having — and it speaks directly to the churn finding, where every
lost customer had a board too quiet to be worth logging into.

## Our position, priced honestly

Live Stripe plans (`StripeProvisioner.PLAN_SPECS`):

| plan | price |
|---|---|
| Cloud Starter | $6/mo |
| Cloud | $29/mo |
| Cloud Pro | $490/yr (~$41/mo) |
| Self-host License | $9/mo · $720/yr |

**We do not meter tracked users at all.** That is the sharpest true thing we can
say against Canny, and it is far stronger than any AI claim we could make: at
$29/mo flat, unlimited voters and commenters, ClearFlask is cheaper than Canny Pro
the moment a board has more than ~25 engaged users — and it gets *relatively*
cheaper the better the board does, where Canny gets more expensive.

Second true thing: **self-host**. Canny has no self-host story. For the compliance
buyer that is not a discount, it is a requirement.

## Note: our own comparison page is out of date

`Competitors.tsx` prices Canny at "$50 base / 100 tracked users" and ClearFlask at
"$10 / $100". Neither matches reality (Canny is free→$19→$79; we are $6/$29/$490yr).
The public compare page is therefore both wrong and less flattering than the truth.
Fixing it is part of the SEO work.

## Recommendation to the board (needs sign-off — this is feature work)

1. **Do not gate dedupe as a premium feature.** Ship basic AI dedupe on paid
   plans generally, or free, and compete on the meter instead.
2. **Re-aim P2 from "AI dedupe + digest" to ingestion.** The digest half stays —
   it is cheap, it is already 70% built, and it pulls quiet-board owners back.
   The dedupe half should be reframed as table stakes, not the headline.
3. **Make "no tracked-user meter" the pricing headline**, on the alternative
   pages and on /pricing.
4. Open question for the board: does the churn evidence (boards dying of silence,
   not of missing features) argue for doing **activation** work before *any* AI
   work? The CEO leans yes, pending the Stripe numbers.

## Not researched yet

UserVoice deliberately skipped per board steer (stale, enterprise, not our
segment). Featurebase, Frill and UserJot not yet priced. **Released**
(releasedhub.com) newly added to the tracking list — it took snow-track.de.
